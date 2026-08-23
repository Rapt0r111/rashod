import { randomUUID } from "node:crypto";
import type {
  LocationGroup,
  LocationGroupConflict,
  LocationOption,
  LogEntry,
  OverviewSettings,
  Person,
  Platoon,
  Snapshot,
} from "@/features/roster/types";
import { MAX_LOG_ENTRIES } from "@/features/roster/constants";
import { normalizeOverviewSettings } from "@/features/roster/overview-settings";
import { inPostgresTransaction, pg } from "./postgres";

type DbPerson = Omit<Person, "createdAt" | "updatedAt"> & { created_at: Date; updated_at: Date };
type DbLog = Omit<LogEntry, "ts"> & { occurred_at: Date };
type LocationGroupInput = Partial<LocationGroup> & Pick<LocationGroup, "label" | "locationKeys"> & { allowTransfer?: boolean };
type DbLocationGroupMember = { groupId: string; locationKey: string; memberOrder: number };
const OVERVIEW_SETTINGS_ID = "default";
const person = (row: DbPerson): Person => ({ ...row, createdAt: row.created_at.getTime(), updatedAt: row.updated_at.getTime() });
const log = (row: DbLog): LogEntry => ({ id: row.id, personId: row.personId, name: row.name, from: row.from, to: row.to, ts: row.occurred_at.getTime() });

export class LocationGroupMembershipConflictError extends Error {
  constructor(public readonly conflicts: LocationGroupConflict[]) {
    super("LOCATION_GROUP_MEMBERSHIP_CONFLICT");
    this.name = "LocationGroupMembershipConflictError";
  }
}

export async function getPostgresSnapshot(): Promise<Snapshot> {
  const sql = pg();
  const [people, platoons, locations, locationGroups, locationGroupMembers, overviewSettingsRow, changeLog] = await Promise.all([
    sql<DbPerson[]>`SELECT id, platoon_id AS "platoonId", rank, name, conscription_number AS "conscriptionNumber", location, sort_order AS "sortOrder", created_at, updated_at FROM people ORDER BY sort_order, name`,
    sql<Platoon[]>`SELECT id, key, label, sort_order AS "sortOrder", is_system AS "isSystem" FROM platoons ORDER BY sort_order, label`,
    sql<LocationOption[]>`SELECT id, key, label, color_token AS "colorToken", is_quick AS "isQuick", quick_code AS "quickCode", is_system AS "isSystem", counts_as_present AS "countsAsPresent", sort_order AS "sortOrder" FROM locations ORDER BY sort_order, label`,
    sql<Array<Omit<LocationGroup, "locationKeys">>>`SELECT id, label, color_token AS "colorToken", enabled, sort_order AS "sortOrder" FROM location_groups ORDER BY sort_order, label`,
    sql<DbLocationGroupMember[]>`SELECT group_id AS "groupId", location_key AS "locationKey", member_order AS "memberOrder" FROM location_group_members ORDER BY group_id, member_order, location_key`,
    sql<Array<{ config: unknown }>>`SELECT config FROM overview_settings WHERE id = ${OVERVIEW_SETTINGS_ID}`,
    sql<DbLog[]>`SELECT id, person_id AS "personId", name, from_value AS "from", to_value AS "to", occurred_at FROM movement_logs ORDER BY occurred_at DESC LIMIT ${MAX_LOG_ENTRIES}`,
  ]);
  const membersByGroup = new Map<string, string[]>();
  for (const member of locationGroupMembers) {
    const members = membersByGroup.get(member.groupId) ?? [];
    members.push(member.locationKey);
    membersByGroup.set(member.groupId, members);
  }
  return {
    people: people.map(person),
    platoons,
    locations,
    locationGroups: locationGroups.map((group) => ({ ...group, locationKeys: membersByGroup.get(group.id) ?? [] })),
    overviewSettings: normalizeOverviewSettings(overviewSettingsRow[0]?.config),
    changeLog: changeLog.map(log),
    serverTime: Date.now(),
  };
}

function assignedLocation(to: string) {
  const location = to.trim();
  if (!location) throw new Error("LOCATION_REQUIRED");
  return location;
}

export async function changePostgresPersonLocation(personId: string, to: string, writeLog = true) {
  const location = assignedLocation(to);
  return inPostgresTransaction(async (transaction) => {
    const rows = await transaction<DbPerson[]>`SELECT id, platoon_id AS "platoonId", rank, name, conscription_number AS "conscriptionNumber", location, sort_order AS "sortOrder", created_at, updated_at FROM people WHERE id = ${personId} FOR UPDATE`;
    const current = rows[0];
    if (!current) throw new Error("PERSON_NOT_FOUND");
    const movement = locationChangeLog(current, location);
    if (!movement) return { person: person(current), log: null as LogEntry | null };
    const updatedRows = await transaction<DbPerson[]>`UPDATE people SET location = ${location}, updated_at = now() WHERE id = ${personId} RETURNING id, platoon_id AS "platoonId", rank, name, conscription_number AS "conscriptionNumber", location, sort_order AS "sortOrder", created_at, updated_at`;
    let entry: LogEntry | null = null;
    if (writeLog) {
      const id = randomUUID();
      const inserted = await transaction<DbLog[]>`INSERT INTO movement_logs (id, person_id, name, from_value, to_value) VALUES (${id}, ${personId}, ${movement.name}, ${movement.from}, ${movement.to}) RETURNING id, person_id AS "personId", name, from_value AS "from", to_value AS "to", occurred_at`;
      entry = log(inserted[0]);
      await transaction`DELETE FROM movement_logs WHERE id IN (SELECT id FROM movement_logs ORDER BY occurred_at DESC OFFSET ${MAX_LOG_ENTRIES})`;
    }
    return { person: person(updatedRows[0]), log: entry };
  });
}

/** Move many people to one location in a single transaction (one SSE burst). */
export async function changePostgresPeopleLocations(personIds: string[], to: string) {
  const location = assignedLocation(to);
  const ids = [...new Set(personIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) {
    return { changed: [] as Array<{ personId: string; name: string; from: string; to: string }> };
  }

  return inPostgresTransaction(async (transaction) => {
    const sql = pg();
    const rows = await transaction<DbPerson[]>`
      SELECT id, platoon_id AS "platoonId", rank, name, conscription_number AS "conscriptionNumber", location, sort_order AS "sortOrder", created_at, updated_at
      FROM people WHERE id = ANY(${sql.array(ids)}) FOR UPDATE
    `;
    if (rows.length !== ids.length) throw new Error("PERSON_NOT_FOUND");

    const toChange = rows.filter((current) => current.location !== location);
    if (!toChange.length) {
      return { changed: [] as Array<{ personId: string; name: string; from: string; to: string }> };
    }

    const changeIds = toChange.map((current) => current.id);
    await transaction`
      UPDATE people
      SET location = ${location}, updated_at = now()
      WHERE id = ANY(${sql.array(changeIds)})
    `;

    const logRows = toChange.map((current) => ({
      id: randomUUID(),
      person_id: current.id,
      name: current.name,
      from_value: current.location,
      to_value: location,
    }));
    await transaction`INSERT INTO movement_logs ${transaction(logRows)}`;
    await transaction`DELETE FROM movement_logs WHERE id IN (SELECT id FROM movement_logs ORDER BY occurred_at DESC OFFSET ${MAX_LOG_ENTRIES})`;

    return {
      changed: toChange.map((current) => ({
        personId: current.id,
        name: current.name,
        from: current.location,
        to: location,
      })),
    };
  });
}

export async function undoPostgresLocations(changes: Array<{ personId: string; location: string }>) {
  await inPostgresTransaction(async (transaction) => {
    for (const change of changes) {
      const location = assignedLocation(change.location);
      const [current] = await transaction<DbPerson[]>`
        SELECT id, platoon_id AS "platoonId", rank, name, conscription_number AS "conscriptionNumber", location, sort_order AS "sortOrder", created_at, updated_at
        FROM people WHERE id = ${change.personId} FOR UPDATE
      `;
      if (!current || current.location === location) continue;
      await transaction`UPDATE people SET location = ${location}, updated_at = now() WHERE id = ${change.personId}`;
      await transaction`
        INSERT INTO movement_logs (id, person_id, name, from_value, to_value)
        VALUES (${randomUUID()}, ${change.personId}, ${current.name}, ${current.location}, ${location})
      `;
    }
    await transaction`DELETE FROM movement_logs WHERE id IN (SELECT id FROM movement_logs ORDER BY occurred_at DESC OFFSET ${MAX_LOG_ENTRIES})`;
  });
}

export function locationChangeLog(
  existing: { name: string; location: string } | undefined,
  nextLocation: string,
): { name: string; from: string; to: string } | null {
  if (!existing || existing.location === nextLocation) return null;
  return { name: existing.name, from: existing.location, to: nextLocation };
}

export async function upsertPostgresPerson(input: Partial<Person> & Pick<Person, "name" | "rank" | "platoonId">) {
  const sql = pg();
  const id = input.id ?? randomUUID();
  const source = await sql`SELECT id FROM platoons WHERE id = ${input.platoonId}`;
  if (!source.length) throw new Error("PLATOON_NOT_FOUND");
  const location = input.location?.trim() || "rota";
  const conscriptionNumber = input.conscriptionNumber?.trim() || null;
  if (!(await sql`SELECT 1 FROM locations WHERE key = ${location}`).length) throw new Error("LOCATION_NOT_FOUND");
  return inPostgresTransaction(async (transaction) => {
    const existing = input.id
      ? (
          await transaction<DbPerson[]>`
            SELECT id, platoon_id AS "platoonId", rank, name, conscription_number AS "conscriptionNumber", location, sort_order AS "sortOrder", created_at, updated_at
            FROM people WHERE id = ${id} FOR UPDATE
          `
        )[0]
      : undefined;
    const result = await transaction<DbPerson[]>`
      INSERT INTO people (id, platoon_id, rank, name, conscription_number, location, sort_order)
      VALUES (${id}, ${input.platoonId}, ${input.rank.trim()}, ${input.name.trim()}, ${conscriptionNumber}, ${location}, ${input.sortOrder ?? Date.now()})
      ON CONFLICT (id) DO UPDATE SET
        platoon_id = EXCLUDED.platoon_id, rank = EXCLUDED.rank, name = EXCLUDED.name,
        conscription_number = EXCLUDED.conscription_number, location = EXCLUDED.location,
        sort_order = EXCLUDED.sort_order, updated_at = now()
      RETURNING id, platoon_id AS "platoonId", rank, name, conscription_number AS "conscriptionNumber", location, sort_order AS "sortOrder", created_at, updated_at
    `;
    const movement = locationChangeLog(existing, location);
    if (movement) {
      await transaction`
        INSERT INTO movement_logs (id, person_id, name, from_value, to_value)
        VALUES (${randomUUID()}, ${id}, ${movement.name}, ${movement.from}, ${movement.to})
      `;
      await transaction`DELETE FROM movement_logs WHERE id IN (SELECT id FROM movement_logs ORDER BY occurred_at DESC OFFSET ${MAX_LOG_ENTRIES})`;
    }
    return person(result[0]);
  });
}

export async function deletePostgresPerson(id: string) {
  await inPostgresTransaction(async (transaction) => {
    await transaction`DELETE FROM group_assignments WHERE person_id = ${id}`;
    await transaction`DELETE FROM group_exclusions WHERE person_id = ${id}`;
    // Same unlink as equipment/storage FK SET NULL; also park the phone in storage.
    await transaction`
      UPDATE phones
      SET person_id = NULL,
          status = 'checked_in',
          checked_in_at = COALESCE(checked_in_at, now()),
          updated_at = now()
      WHERE person_id = ${id} AND deleted_at IS NULL
    `;
    const deleted = await transaction`DELETE FROM people WHERE id = ${id} RETURNING id`;
    if (!deleted.length) throw new Error("PERSON_NOT_FOUND");
  });
}

function slug(value: string) { return value.toLocaleLowerCase("ru-RU").replace(/[^a-zа-я0-9]+/giu, "-").replace(/^-+|-+$/g, "") || randomUUID(); }
export async function upsertPostgresPlatoon(
  input: Omit<Partial<Platoon>, "isSystem"> & Pick<Platoon, "label">,
) {
  const record = {
    id: input.id ?? randomUUID(),
    key: input.key?.trim() || slug(input.label),
    label: input.label.trim(),
    sortOrder: input.sortOrder ?? Date.now(),
  };
  const rows = await pg()<Platoon[]>`
    INSERT INTO platoons (id, key, label, sort_order, is_system)
    VALUES (${record.id}, ${record.key}, ${record.label}, ${record.sortOrder}, false)
    ON CONFLICT (id) DO UPDATE SET
      key = EXCLUDED.key,
      label = EXCLUDED.label,
      sort_order = EXCLUDED.sort_order
    RETURNING id, key, label, sort_order AS "sortOrder", is_system AS "isSystem"
  `;
  return rows[0];
}
export async function deletePostgresPlatoon(id: string) {
  await inPostgresTransaction(async (transaction) => {
    const platoon = (
      await transaction<Array<{ isSystem: boolean }>>`
        SELECT is_system AS "isSystem" FROM platoons WHERE id = ${id} FOR UPDATE
      `
    )[0];
    if (!platoon) return;
    if (platoon.isSystem) throw new Error("SYSTEM_PLATOON_PROTECTED");
    if ((await transaction`SELECT 1 FROM people WHERE platoon_id = ${id} LIMIT 1`).length)
      throw new Error("PLATOON_IN_USE");
    await transaction`DELETE FROM platoons WHERE id = ${id}`;
  });
}
export async function upsertPostgresLocation(
  input: Omit<Partial<LocationOption>, "isSystem"> & Pick<LocationOption, "label">,
) {
  const sql = pg();
  const existing = input.id
    ? (await sql<Array<{ key: string; countsAsPresent: boolean }>>`
        SELECT key, counts_as_present AS "countsAsPresent" FROM locations WHERE id = ${input.id}
      `)[0]
    : undefined;
  const record = {
    id: input.id ?? randomUUID(),
    key: input.key?.trim() || existing?.key || slug(input.label),
    label: input.label.trim(),
    colorToken: input.colorToken ?? "neutral",
    isQuick: input.isQuick ?? false,
    quickCode: input.quickCode?.trim() || null,
    countsAsPresent: input.countsAsPresent ?? existing?.countsAsPresent ?? false,
    sortOrder: input.sortOrder ?? Date.now(),
  };
  return inPostgresTransaction(async (transaction) => {
    const rows = await transaction<LocationOption[]>`
      INSERT INTO locations (id, key, label, color_token, is_quick, quick_code, is_system, counts_as_present, sort_order)
      VALUES (
        ${record.id}, ${record.key}, ${record.label}, ${record.colorToken}, ${record.isQuick},
        ${record.quickCode}, false, ${record.countsAsPresent}, ${record.sortOrder}
      )
      ON CONFLICT (id) DO UPDATE SET
        key = EXCLUDED.key,
        label = EXCLUDED.label,
        color_token = EXCLUDED.color_token,
        is_quick = EXCLUDED.is_quick,
        quick_code = EXCLUDED.quick_code,
        counts_as_present = EXCLUDED.counts_as_present,
        sort_order = EXCLUDED.sort_order
      RETURNING
        id, key, label, color_token AS "colorToken", is_quick AS "isQuick", quick_code AS "quickCode",
        is_system AS "isSystem", counts_as_present AS "countsAsPresent", sort_order AS "sortOrder"
    `;
    if (existing && existing.key !== record.key) {
      await transaction`UPDATE people SET location = ${record.key}, updated_at = now() WHERE location = ${existing.key}`;
      await transaction`UPDATE location_group_members SET location_key = ${record.key} WHERE location_key = ${existing.key}`;
    }
    return rows[0];
  });
}
export async function upsertPostgresLocationGroup(input: LocationGroupInput) {
  const id = input.id ?? randomUUID();
  const locationKeys = [...new Set(input.locationKeys.map((key) => key.trim()).filter(Boolean))];
  const record = {
    id,
    label: input.label.trim(),
    colorToken: input.colorToken ?? "cyan",
    enabled: input.enabled ?? true,
    sortOrder: input.sortOrder ?? Date.now(),
  };
  const sql = pg();
  await inPostgresTransaction(async (transaction) => {
    const conflicts = locationKeys.length
      ? await transaction<LocationGroupConflict[]>`
          SELECT members.location_key AS "locationKey", members.group_id AS "groupId", groups.label AS "groupLabel"
          FROM location_group_members AS members
          JOIN location_groups AS groups ON groups.id = members.group_id
          WHERE members.location_key = ANY(${sql.array(locationKeys)})
            AND members.group_id <> ${record.id}
          ORDER BY groups.sort_order, groups.label
        `
      : [];
    if (conflicts.length && !input.allowTransfer) {
      throw new LocationGroupMembershipConflictError(conflicts);
    }
    await transaction`
      INSERT INTO location_groups (id, label, color_token, enabled, sort_order)
      VALUES (${record.id}, ${record.label}, ${record.colorToken}, ${record.enabled}, ${record.sortOrder})
      ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        color_token = EXCLUDED.color_token,
        enabled = EXCLUDED.enabled,
        sort_order = EXCLUDED.sort_order,
        updated_at = now()
    `;
    if (conflicts.length) {
      await transaction`
        DELETE FROM location_group_members
        WHERE location_key = ANY(${sql.array(locationKeys)})
          AND group_id <> ${record.id}
      `;
    }
    await transaction`DELETE FROM location_group_members WHERE group_id = ${record.id}`;
    for (const [memberOrder, locationKey] of locationKeys.entries()) {
      await transaction`
        INSERT INTO location_group_members (group_id, location_key, member_order)
        VALUES (${record.id}, ${locationKey}, ${memberOrder})
      `;
    }
  });
  return getPostgresSnapshot();
}

export async function deletePostgresLocationGroup(id: string) {
  await pg()`DELETE FROM location_groups WHERE id = ${id}`;
  return getPostgresSnapshot();
}

export async function getPostgresOverviewSettings(): Promise<OverviewSettings> {
  const rows = await pg()<Array<{ config: unknown }>>`SELECT config FROM overview_settings WHERE id = ${OVERVIEW_SETTINGS_ID}`;
  return normalizeOverviewSettings(rows[0]?.config);
}

export async function upsertPostgresOverviewSettings(input: OverviewSettings) {
  const config = normalizeOverviewSettings(input);
  const sql = pg();
  await sql`
    INSERT INTO overview_settings (id, config, updated_at)
    VALUES (${OVERVIEW_SETTINGS_ID}, ${sql.json(config)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config, updated_at = now()
  `;
  return getPostgresSnapshot();
}

export async function deletePostgresLocation(id: string) {
  await inPostgresTransaction(async (transaction) => {
    const location = (
      await transaction<Array<{ key: string; isSystem: boolean }>>`
        SELECT key, is_system AS "isSystem" FROM locations WHERE id = ${id} FOR UPDATE
      `
    )[0];
    if (!location) return;
    if (location.isSystem) throw new Error("SYSTEM_LOCATION_PROTECTED");
    if ((await transaction`SELECT 1 FROM people WHERE location = ${location.key} LIMIT 1`).length) throw new Error("LOCATION_IN_USE");
    await transaction`DELETE FROM location_group_members WHERE location_key = ${location.key}`;
    await transaction`DELETE FROM locations WHERE id = ${id}`;
  });
}
export async function getPostgresPeopleByIds(ids: string[]) { if (!ids.length) return []; return (await pg()<DbPerson[]>`SELECT id, platoon_id AS "platoonId", rank, name, conscription_number AS "conscriptionNumber", location, sort_order AS "sortOrder", created_at, updated_at FROM people WHERE id = ANY(${pg().array(ids)})`).map(person); }

import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import type { Person, Platoon } from "@/features/roster/types";
import type {
  ConflictState,
  DutyGroup,
  DutyGroupSnapshot,
  GroupAssignment,
  GroupConflict,
  GroupCreateInput,
  GroupDaySnapshot,
  GroupExclusion,
  GroupRule,
  GroupsSnapshot,
  GroupTemplate,
  GroupUpdateInput,
  RuleUpdateInput,
} from "@/features/groups/types";
import {
  dayOfWeekFromKey,
  filterCandidates,
  findExcessAutomaticAssignmentIds,
  findStaleAutomaticAssignmentIds,
  localDateKey,
  normalizePriorityMode,
  pickRotationCandidates,
  weekDates,
} from "@/features/groups/logic";
import { inPostgresTransaction, pg } from "./postgres";

type DbPerson = Omit<Person, "createdAt" | "updatedAt"> & { created_at: Date; updated_at: Date };
type DbTemplate = Omit<GroupTemplate, "createdAt" | "defaultActiveDays"> & { defaultActiveDays: unknown; created_at: Date };
type DbGroup = Omit<DutyGroup, "createdAt" | "updatedAt"> & { created_at: Date; updated_at: Date };
type DbRule = Omit<GroupRule, "enabledPlatoons" | "activeDays" | "priorityMode"> & {
  enabledPlatoons: unknown;
  activeDays: unknown;
  priorityMode: unknown;
};
type DbAssignment = Omit<GroupAssignment, "personName" | "personRank" | "personConscriptionNumber" | "conflicts" | "source" | "conflictState" | "createdAt"> & {
  source: string;
  conflictState: string;
  created_at: Date;
};
type DbExclusion = Omit<GroupExclusion, "personName" | "personRank" | "personConscriptionNumber" | "createdAt"> & { created_at: Date };
type SnapshotRuleRow = {
  groupId: string;
  ruleId: string | null;
  enabledPlatoons: unknown;
  peoplePerDay: number | null;
  autoRotate: boolean | null;
  activeDays: unknown;
  priorityMode: unknown;
  defaultPeoplePerDay: number;
  defaultActiveDays: unknown;
};
type SnapshotAssignmentRow = DbAssignment & {
  personName: string | null;
  personRank: string | null;
  personConscriptionNumber: string | null;
};
type SnapshotExclusionRow = DbExclusion & {
  personName: string | null;
  personRank: string | null;
  personConscriptionNumber: string | null;
};
type SqlExecutor = ReturnType<typeof pg> | postgres.TransactionSql;
export type GroupAssignmentIneligibilityReason = "excluded" | "platoon_disabled" | "inactive_day" | "group_disabled";
export function groupAssignmentIneligibility(input: { groupEnabled: boolean; activeDays: readonly number[]; dayOfWeek: number; enabledPlatoons: readonly string[]; personPlatoonId: string; excluded: boolean }): GroupAssignmentIneligibilityReason | null { if (!input.groupEnabled) return "group_disabled"; if (!input.activeDays.includes(input.dayOfWeek)) return "inactive_day"; if (input.enabledPlatoons.length > 0 && !input.enabledPlatoons.includes(input.personPlatoonId)) return "platoon_disabled"; if (input.excluded) return "excluded"; return null; }
export class GroupAssignmentIneligibleError extends Error { constructor(public readonly reason: GroupAssignmentIneligibilityReason) { super("GROUP_ASSIGNMENT_INELIGIBLE"); this.name = "GroupAssignmentIneligibleError"; } }

const ALL_ACTIVE_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

function unwrapJsonScalar(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

export function normalizeActiveDays(value: unknown, fallback: number[] = [...ALL_ACTIVE_DAYS]): number[] {
  const unwrapped = unwrapJsonScalar(value);
  if (!Array.isArray(unwrapped)) return [...fallback];
  const normalized = unwrapped
    .map((item) => {
      if (typeof item === "number") return item;
      if (typeof item === "string" && item.trim() !== "") return Number(item);
      return Number.NaN;
    })
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6);
  const unique = [...new Set(normalized)].sort((left, right) => left - right);
  return unique.length || unwrapped.length === 0 ? unique : [...fallback];
}

export function normalizeStringArray(value: unknown): string[] {
  const unwrapped = unwrapJsonScalar(value);
  if (!Array.isArray(unwrapped)) return [];
  return [...new Set(unwrapped.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}

function toPerson(row: DbPerson): Person {
  return { ...row, createdAt: row.created_at.getTime(), updatedAt: row.updated_at.getTime() };
}

function toTemplate(row: DbTemplate): GroupTemplate {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    colorToken: row.colorToken,
    icon: row.icon,
    defaultPeoplePerDay: row.defaultPeoplePerDay,
    defaultActiveDays: normalizeActiveDays(row.defaultActiveDays),
    sortOrder: row.sortOrder,
    isSystem: row.isSystem,
    createdAt: row.created_at.getTime(),
  };
}

function toGroup(row: DbGroup): DutyGroup {
  return {
    id: row.id,
    templateId: row.templateId,
    name: row.name,
    notes: row.notes,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    createdAt: row.created_at.getTime(),
    updatedAt: row.updated_at.getTime(),
  };
}

function toRule(row: DbRule): GroupRule {
  return {
    id: row.id,
    groupId: row.groupId,
    enabledPlatoons: normalizeStringArray(row.enabledPlatoons),
    peoplePerDay: row.peoplePerDay,
    autoRotate: row.autoRotate,
    activeDays: normalizeActiveDays(row.activeDays),
    priorityMode: normalizePriorityMode(row.priorityMode),
  };
}

function assignmentDate(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString().slice(0, 10);
}

async function getDutyTemplates(): Promise<GroupTemplate[]> {
  const rows = await pg()<DbTemplate[]>`
    SELECT id, key, name, color_token AS "colorToken", icon,
      default_people_per_day AS "defaultPeoplePerDay", default_active_days AS "defaultActiveDays",
      sort_order AS "sortOrder", is_system AS "isSystem", created_at
    FROM group_templates ORDER BY sort_order, name
  `;
  return rows.map(toTemplate);
}

async function getDutyGroups(sql: SqlExecutor = pg()): Promise<DutyGroup[]> {
  const rows = await sql<DbGroup[]>`
    SELECT id, template_id AS "templateId", name, notes, enabled, sort_order AS "sortOrder", created_at, updated_at
    FROM duty_groups ORDER BY sort_order, name
  `;
  return rows.map(toGroup);
}

async function allPeopleSorted(sql: SqlExecutor = pg()): Promise<Person[]> {
  const rows = await sql<DbPerson[]>`
    SELECT id, platoon_id AS "platoonId", rank, name, conscription_number AS "conscriptionNumber", location, sort_order AS "sortOrder", created_at, updated_at
    FROM people ORDER BY sort_order, name
  `;
  return rows.map(toPerson);
}

async function getPlatoons(): Promise<Platoon[]> {
  return pg()<Platoon[]>`SELECT id, key, label, sort_order AS "sortOrder", is_system AS "isSystem" FROM platoons ORDER BY sort_order, label`;
}

async function getDutyRule(groupId: string, sql: SqlExecutor = pg()): Promise<GroupRule> {
  const rows = await sql<DbRule[]>`
    SELECT id, group_id AS "groupId", enabled_platoons AS "enabledPlatoons", people_per_day AS "peoplePerDay",
      auto_rotate AS "autoRotate", active_days AS "activeDays", priority_mode AS "priorityMode"
    FROM group_rules WHERE group_id = ${groupId}
  `;
  if (rows[0]) return toRule(rows[0]);

  const defaults = await sql<Array<{ defaultPeoplePerDay: number; defaultActiveDays: unknown }>>`
    SELECT gt.default_people_per_day AS "defaultPeoplePerDay", gt.default_active_days AS "defaultActiveDays"
    FROM duty_groups dg JOIN group_templates gt ON gt.id = dg.template_id
    WHERE dg.id = ${groupId}
  `;
  if (!defaults[0]) throw new Error("GROUP_NOT_FOUND");
  const rule: GroupRule = {
    id: randomUUID(),
    groupId,
    enabledPlatoons: [],
    peoplePerDay: defaults[0].defaultPeoplePerDay,
    autoRotate: true,
    activeDays: normalizeActiveDays(defaults[0].defaultActiveDays),
    priorityMode: "oldest",
  };
  // Snapshot reads must stay side-effect free. Explicit write paths create a
  // missing rule before updating it; a legacy missing rule can still render
  // from template defaults without mutating the database during GET.
  return rule;
}

async function getDutyExclusions(groupId: string, sql: SqlExecutor = pg()): Promise<GroupExclusion[]> {
  const rows = await sql<Array<DbExclusion & { personName: string | null; personRank: string | null; personConscriptionNumber: string | null }>>`
    SELECT ge.id, ge.group_id AS "groupId", ge.person_id AS "personId", ge.day_of_week AS "dayOfWeek", ge.reason, ge.created_at,
      p.name AS "personName", p.rank AS "personRank", p.conscription_number AS "personConscriptionNumber"
    FROM group_exclusions ge LEFT JOIN people p ON p.id = ge.person_id
    WHERE ge.group_id = ${groupId}
  `;
  return rows.map((row) => ({
    id: row.id, groupId: row.groupId, personId: row.personId, personName: row.personName, personRank: row.personRank, personConscriptionNumber: row.personConscriptionNumber,
    dayOfWeek: row.dayOfWeek, reason: row.reason, createdAt: row.created_at.getTime(),
  }));
}

async function conflictRows(personId: string, date: string, ownGroupId?: string, sql: SqlExecutor = pg()): Promise<GroupConflict[]> {
  const rows = await sql<Array<{ groupId: string; groupName: string; assignedDate: string | Date }>>`
    SELECT ga.group_id AS "groupId", dg.name AS "groupName", ga.assigned_date AS "assignedDate"
    FROM group_assignments ga JOIN duty_groups dg ON dg.id = ga.group_id
    WHERE ga.person_id = ${personId} AND ga.assigned_date = ${date}::date
      AND (${ownGroupId ?? null}::text IS NULL OR ga.group_id <> ${ownGroupId ?? null}::text)
  `;
  return rows.map((row) => ({ groupId: row.groupId, groupName: row.groupName, date: assignmentDate(row.assignedDate) }));
}

async function enrichDutyAssignments(rows: DbAssignment[], sql: SqlExecutor = pg()): Promise<GroupAssignment[]> {
  return Promise.all(rows.map(async (row) => {
    const [person] = await sql<Array<{ name: string; rank: string; conscriptionNumber: string | null }>>`SELECT name, rank, conscription_number AS "conscriptionNumber" FROM people WHERE id = ${row.personId}`;
    const conflicts = await conflictRows(row.personId, assignmentDate(row.assignedDate), row.groupId, sql);
    return {
      id: row.id,
      groupId: row.groupId,
      personId: row.personId,
      personName: person?.name ?? null,
      personRank: person?.rank ?? null,
      personConscriptionNumber: person?.conscriptionNumber ?? null,
      assignedDate: assignmentDate(row.assignedDate),
      source: row.source === "manual" ? "manual" : "auto",
      conflictState: conflicts.length > 0 ? "warning" : (row.conflictState === "warning" ? "warning" : "clear"),
      conflicts,
      createdAt: row.created_at.getTime(),
    } satisfies GroupAssignment;
  }));
}

async function getAssignmentsForGroup(groupId: string, sql: SqlExecutor = pg()): Promise<GroupAssignment[]> {
  const rows = await sql<DbAssignment[]>`
    SELECT id, group_id AS "groupId", person_id AS "personId", assigned_date AS "assignedDate", source, conflict_state AS "conflictState", created_at
    FROM group_assignments WHERE group_id = ${groupId} ORDER BY assigned_date, created_at
  `;
  return enrichDutyAssignments(rows, sql);
}

async function getAssignmentsForGroupDate(groupId: string, date: string, sql: SqlExecutor = pg()): Promise<GroupAssignment[]> {
  return (await getAssignmentsForGroup(groupId, sql)).filter((assignment) => assignment.assignedDate === date);
}

async function assignedPersonIdsOnDate(date: string, ownGroupId?: string, sql: SqlExecutor = pg()): Promise<Set<string>> {
  const rows = await sql<Array<{ personId: string }>>`
    SELECT person_id AS "personId" FROM group_assignments
    WHERE assigned_date = ${date}::date AND (${ownGroupId ?? null}::text IS NULL OR group_id <> ${ownGroupId ?? null}::text)
  `;
  return new Set(rows.map((row) => row.personId));
}

async function deleteDutyAssignments(ids: string[], sql: SqlExecutor = pg()) {
  for (const id of ids) await sql`DELETE FROM group_assignments WHERE id = ${id}`;
}

async function writeDutyAssignment(groupId: string, personId: string, date: string, source: "auto" | "manual", conflictState: ConflictState = "clear", sql: SqlExecutor = pg()) {
  await sql`
    INSERT INTO group_assignments (id, group_id, person_id, assigned_date, source, conflict_state)
    VALUES (${randomUUID()}, ${groupId}, ${personId}, ${date}::date, ${source}, ${conflictState})
    ON CONFLICT (group_id, person_id, assigned_date) DO NOTHING
  `;
}

async function lockAssignmentDay(sql: SqlExecutor, date: string, groupId: string, personId?: string) {
  await sql`SELECT pg_advisory_xact_lock(hashtext(${`group-assignment-date:${date}`}::text)::bigint)`;
  await sql`SELECT pg_advisory_xact_lock(hashtext(${`group-assignment-group-date:${groupId}:${date}`}::text)::bigint)`;
  if (personId) await sql`SELECT pg_advisory_xact_lock(hashtext(${`group-assignment-person-date:${personId}:${date}`}::text)::bigint)`;
}

async function ensureGroupAssignments(group: DutyGroup, rule: GroupRule, date: string, sql?: SqlExecutor): Promise<void> {
  if (!sql) return inPostgresTransaction((transaction) => ensureGroupAssignments(group, rule, date, transaction));
  if (!group.enabled || !rule.activeDays.includes(dayOfWeekFromKey(date))) {
    if (!rule.autoRotate) return;
    await lockAssignmentDay(sql, date, group.id);
    const current = await getAssignmentsForGroupDate(group.id, date, sql);
    const automaticIds = current.filter((assignment) => assignment.source === "auto").map((assignment) => assignment.id);
    if (automaticIds.length) await deleteDutyAssignments(automaticIds, sql);
    return;
  }
  if (!rule.autoRotate) return;
  await lockAssignmentDay(sql, date, group.id);
  const exclusions = await getDutyExclusions(group.id, sql);
  const people = await allPeopleSorted(sql);
  const candidates = filterCandidates(people, rule, exclusions, date);
  const eligiblePersonIds = new Set(candidates.map((person) => person.id));
  let current = await getAssignmentsForGroupDate(group.id, date, sql);
  const staleAutoIds = [
    ...findStaleAutomaticAssignmentIds(current, eligiblePersonIds),
    ...findExcessAutomaticAssignmentIds(current, rule.peoplePerDay),
    ...current
      .filter((assignment) => assignment.source === "auto" && assignment.conflicts.length > 0)
      .map((assignment) => assignment.id),
  ];
  const idsToDelete = [...new Set(staleAutoIds)];
  if (idsToDelete.length) {
    await deleteDutyAssignments(idsToDelete, sql);
    current = current.filter((assignment) => !idsToDelete.includes(assignment.id));
  }
  const remaining = Math.max(0, rule.peoplePerDay - current.length);
  if (!remaining) return;
  const history = await getAssignmentsForGroup(group.id, sql);
  const blocked = await assignedPersonIdsOnDate(date, group.id, sql);
  const availableCandidates = candidates.filter((person) => !current.some((assignment) => assignment.personId === person.id));
  const picked = pickRotationCandidates(availableCandidates, history, remaining, blocked, rule.priorityMode);
  for (const person of picked) await writeDutyAssignment(group.id, person.id, date, "auto", "clear", sql);
}

function buildDutyGroupSnapshotFromData(
  group: DutyGroup,
  templates: GroupTemplate[],
  dates: string[],
  platoonRows: Platoon[],
  people: Person[],
  rulesByGroup: ReadonlyMap<string, GroupRule>,
  exclusionsByGroup: ReadonlyMap<string, GroupExclusion[]>,
  assignmentsByGroup: ReadonlyMap<string, GroupAssignment[]>,
): DutyGroupSnapshot {
  const template = templates.find((item) => item.id === group.templateId) ?? templates[0];
  if (!template) throw new Error("GROUP_TEMPLATE_REQUIRED");
  const rule = rulesByGroup.get(group.id);
  if (!rule) throw new Error("GROUP_RULE_REQUIRED");
  const exclusions = exclusionsByGroup.get(group.id) ?? [];
  const assignments = assignmentsByGroup.get(group.id) ?? [];
  const today = dates[0] ?? localDateKey();
  const candidatePeople = people.filter((person) => rule.enabledPlatoons.length === 0 || rule.enabledPlatoons.includes(person.platoonId));
  const candidatesByDate = new Map(dates.map((date) => [date, filterCandidates(people, rule, exclusions, date)]));
  const assignmentsByDate = new Map<string, GroupAssignment[]>();
  for (const assignment of assignments) {
    const dayAssignments = assignmentsByDate.get(assignment.assignedDate) ?? [];
    dayAssignments.push(assignment);
    assignmentsByDate.set(assignment.assignedDate, dayAssignments);
  }
  const availablePeopleByDate = Object.fromEntries(dates.map((date) => {
    const assignedIds = new Set((assignmentsByDate.get(date) ?? []).map((assignment) => assignment.personId));
    return [date, (candidatesByDate.get(date) ?? []).filter((person) => !assignedIds.has(person.id))];
  }));
  const availableToday = availablePeopleByDate[today] ?? [];
  const candidatePlatoons = rule.enabledPlatoons.length === 0 ? platoonRows : platoonRows.filter((platoon) => rule.enabledPlatoons.includes(platoon.id));
  const week: GroupDaySnapshot[] = dates.map((date) => {
    const dayAssignments = assignmentsByDate.get(date) ?? [];
    const candidates = candidatesByDate.get(date) ?? [];
    return {
      date,
      dayOfWeek: dayOfWeekFromKey(date),
      isActive: group.enabled && rule.activeDays.includes(dayOfWeekFromKey(date)),
      assignments: dayAssignments,
      candidatesCount: candidates.length,
      conflictsCount: dayAssignments.filter((item) => item.conflicts.length > 0).length,
    };
  });
  const todayAssignments = assignmentsByDate.get(today) ?? [];
  return {
    group,
    template,
    rule,
    todayAssignments,
    week,
    exclusions,
    availablePeople: availableToday,
    availablePeopleByDate,
    candidatePeople,
    candidatePlatoons,
    stats: {
      assignedToday: todayAssignments.length,
      availableToday: availableToday.length,
      conflictsToday: todayAssignments.filter((item) => item.conflicts.length > 0).length,
      weekAssignments: week.reduce((sum, day) => sum + day.assignments.length, 0),
    },
  };
}

export async function getPostgresGroupsSnapshot(): Promise<GroupsSnapshot> {
  const sql = pg();
  const dates = weekDates(new Date(), 7);
  const [templates, groups, platoons, people, ruleRows, exclusionRows, assignmentRows] = await Promise.all([
    getDutyTemplates(),
    getDutyGroups(),
    getPlatoons(),
    allPeopleSorted(),
    sql<SnapshotRuleRow[]>`
      SELECT dg.id AS "groupId", gr.id AS "ruleId",
        gr.enabled_platoons AS "enabledPlatoons", gr.people_per_day AS "peoplePerDay",
        gr.auto_rotate AS "autoRotate", gr.active_days AS "activeDays", gr.priority_mode AS "priorityMode",
        gt.default_people_per_day AS "defaultPeoplePerDay", gt.default_active_days AS "defaultActiveDays"
      FROM duty_groups dg
      JOIN group_templates gt ON gt.id = dg.template_id
      LEFT JOIN group_rules gr ON gr.group_id = dg.id
    `,
    sql<SnapshotExclusionRow[]>`
      SELECT ge.id, ge.group_id AS "groupId", ge.person_id AS "personId", ge.day_of_week AS "dayOfWeek",
        ge.reason, ge.created_at, p.name AS "personName", p.rank AS "personRank",
        p.conscription_number AS "personConscriptionNumber"
      FROM group_exclusions ge
      LEFT JOIN people p ON p.id = ge.person_id
      ORDER BY ge.group_id, ge.created_at
    `,
    sql<SnapshotAssignmentRow[]>`
      SELECT ga.id, ga.group_id AS "groupId", ga.person_id AS "personId", ga.assigned_date AS "assignedDate",
        ga.source, ga.conflict_state AS "conflictState", ga.created_at,
        p.name AS "personName", p.rank AS "personRank", p.conscription_number AS "personConscriptionNumber"
      FROM group_assignments ga
      LEFT JOIN people p ON p.id = ga.person_id
      ORDER BY ga.group_id, ga.assigned_date, ga.created_at
    `,
  ]);
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const assignmentsByPersonDate = new Map<string, SnapshotAssignmentRow[]>();
  for (const row of assignmentRows) {
    const key = `${row.personId}\u0000${assignmentDate(row.assignedDate)}`;
    const rows = assignmentsByPersonDate.get(key) ?? [];
    rows.push(row);
    assignmentsByPersonDate.set(key, rows);
  }
  const assignmentsByGroup = new Map<string, GroupAssignment[]>();
  for (const row of assignmentRows) {
    const key = `${row.personId}\u0000${assignmentDate(row.assignedDate)}`;
    const conflicts = (assignmentsByPersonDate.get(key) ?? [])
      .filter((other) => other.groupId !== row.groupId)
      .map((other) => ({
        groupId: other.groupId,
        groupName: groupNames.get(other.groupId) ?? other.groupId,
        date: assignmentDate(other.assignedDate),
      }));
    const assignment: GroupAssignment = {
      id: row.id,
      groupId: row.groupId,
      personId: row.personId,
      personName: row.personName,
      personRank: row.personRank,
      personConscriptionNumber: row.personConscriptionNumber,
      assignedDate: assignmentDate(row.assignedDate),
      source: row.source === "manual" ? "manual" : "auto",
      conflictState: conflicts.length > 0 || row.conflictState === "warning" ? "warning" : "clear",
      conflicts,
      createdAt: row.created_at.getTime(),
    };
    const assignments = assignmentsByGroup.get(row.groupId) ?? [];
    assignments.push(assignment);
    assignmentsByGroup.set(row.groupId, assignments);
  }
  const rulesByGroup = new Map<string, GroupRule>();
  for (const row of ruleRows) {
    rulesByGroup.set(row.groupId, row.ruleId
      ? toRule({
          id: row.ruleId,
          groupId: row.groupId,
          enabledPlatoons: row.enabledPlatoons,
          peoplePerDay: row.peoplePerDay ?? row.defaultPeoplePerDay,
          autoRotate: row.autoRotate ?? true,
          activeDays: row.activeDays,
          priorityMode: row.priorityMode,
        })
      : {
          id: randomUUID(),
          groupId: row.groupId,
          enabledPlatoons: [],
          peoplePerDay: row.defaultPeoplePerDay,
          autoRotate: true,
          activeDays: normalizeActiveDays(row.defaultActiveDays),
          priorityMode: "oldest",
        });
  }
  const exclusionsByGroup = new Map<string, GroupExclusion[]>();
  for (const row of exclusionRows) {
    const exclusion: GroupExclusion = {
      id: row.id,
      groupId: row.groupId,
      personId: row.personId,
      personName: row.personName,
      personRank: row.personRank,
      personConscriptionNumber: row.personConscriptionNumber,
      dayOfWeek: row.dayOfWeek,
      reason: row.reason,
      createdAt: row.created_at.getTime(),
    };
    const exclusions = exclusionsByGroup.get(row.groupId) ?? [];
    exclusions.push(exclusion);
    exclusionsByGroup.set(row.groupId, exclusions);
  }
  const snapshots = groups.map((group) => [
    group.id,
    buildDutyGroupSnapshotFromData(group, templates, dates, platoons, people, rulesByGroup, exclusionsByGroup, assignmentsByGroup),
  ] as const);
  return { templates, groups, platoons, groupSnapshots: Object.fromEntries(snapshots), weekDates: dates };
}

/** Explicit scheduler/action entry point. Snapshot reads never write assignments. */
export async function refreshPostgresAutomaticDutyAssignments(days = 7): Promise<GroupsSnapshot> {
  const dates = weekDates(new Date(), days);
  await inPostgresTransaction(async (transaction) => {
    for (const group of await getDutyGroups(transaction)) {
      const rule = await getDutyRule(group.id, transaction);
      for (const date of dates) await ensureGroupAssignments(group, rule, date, transaction);
    }
  });
  return getPostgresGroupsSnapshot();
}

export async function createPostgresDutyGroup(input: GroupCreateInput): Promise<GroupsSnapshot> {
  const sql = pg();
  const [template] = await sql<Array<{ defaultPeoplePerDay: number; defaultActiveDays: unknown }>>`
    SELECT default_people_per_day AS "defaultPeoplePerDay", default_active_days AS "defaultActiveDays" FROM group_templates WHERE id = ${input.templateId}
  `;
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");
  const groupId = randomUUID();
  const now = Date.now();
  await inPostgresTransaction(async (transaction) => {
    await transaction`INSERT INTO duty_groups (id, template_id, name, notes, enabled, sort_order) VALUES (${groupId}, ${input.templateId}, ${input.name.trim()}, ${input.notes?.trim() ?? ""}, true, ${now})`;
    await transaction`INSERT INTO group_rules (id, group_id, enabled_platoons, people_per_day, auto_rotate, active_days, priority_mode) VALUES (${randomUUID()}, ${groupId}, ${transaction.json([])}::jsonb, ${template.defaultPeoplePerDay}, true, ${transaction.json(normalizeActiveDays(template.defaultActiveDays))}::jsonb, 'oldest')`;
  });
  return refreshPostgresAutomaticDutyAssignments();
}

export async function updatePostgresDutyGroup(input: GroupUpdateInput): Promise<GroupsSnapshot> {
  const sql = pg();
  const [current] = await sql<DbGroup[]>`SELECT id, template_id AS "templateId", name, notes, enabled, sort_order AS "sortOrder", created_at, updated_at FROM duty_groups WHERE id = ${input.id}`;
  if (!current) throw new Error("GROUP_NOT_FOUND");
  if (input.templateId) {
    const template = await sql`SELECT 1 FROM group_templates WHERE id = ${input.templateId}`;
    if (!template.length) throw new Error("TEMPLATE_NOT_FOUND");
  }
  await sql`
    UPDATE duty_groups SET template_id = ${input.templateId ?? current.templateId}, name = ${input.name?.trim() ?? current.name},
      notes = ${input.notes?.trim() ?? current.notes}, enabled = ${input.enabled ?? current.enabled}, updated_at = now()
    WHERE id = ${input.id}
  `;
  return refreshPostgresAutomaticDutyAssignments();
}

export async function deletePostgresDutyGroup(id: string): Promise<GroupsSnapshot> {
  await pg()`DELETE FROM duty_groups WHERE id = ${id}`;
  return getPostgresGroupsSnapshot();
}

export async function updatePostgresDutyGroupRule(input: RuleUpdateInput): Promise<GroupsSnapshot> {
  const sql = pg();
  const current = await getDutyRule(input.groupId, sql);
  const existing = await sql`SELECT 1 FROM group_rules WHERE group_id = ${input.groupId}`;
  if (!existing.length) {
    await sql`
      INSERT INTO group_rules (id, group_id, enabled_platoons, people_per_day, auto_rotate, active_days, priority_mode)
      VALUES (${current.id}, ${current.groupId}, ${sql.json(current.enabledPlatoons)}::jsonb, ${current.peoplePerDay}, ${current.autoRotate}, ${sql.json(current.activeDays)}::jsonb, ${current.priorityMode})
      ON CONFLICT (group_id) DO NOTHING
    `;
  }
  const rule = {
    enabledPlatoons: normalizeStringArray(input.enabledPlatoons ?? current.enabledPlatoons),
    peoplePerDay: input.peoplePerDay ?? current.peoplePerDay,
    autoRotate: input.autoRotate ?? current.autoRotate,
    activeDays: normalizeActiveDays(input.activeDays ?? current.activeDays),
    priorityMode: normalizePriorityMode(input.priorityMode ?? current.priorityMode),
  };
  if (!Number.isInteger(rule.peoplePerDay) || rule.peoplePerDay < 1) throw new Error("PEOPLE_PER_DAY_INVALID");
  await sql`
    UPDATE group_rules SET enabled_platoons = ${sql.json(rule.enabledPlatoons)}::jsonb, people_per_day = ${rule.peoplePerDay},
      auto_rotate = ${rule.autoRotate}, active_days = ${sql.json(rule.activeDays)}::jsonb, priority_mode = ${rule.priorityMode}
    WHERE group_id = ${input.groupId}
  `;
  return refreshPostgresAutomaticDutyAssignments();
}

export async function rotatePostgresDutyGroup(groupId: string, date = localDateKey()): Promise<GroupsSnapshot> {
  await inPostgresTransaction(async (transaction) => {
    await lockAssignmentDay(transaction, date, groupId);
    const [group] = await transaction<DbGroup[]>`SELECT id, template_id AS "templateId", name, notes, enabled, sort_order AS "sortOrder", created_at, updated_at FROM duty_groups WHERE id = ${groupId} FOR UPDATE`;
    if (!group) throw new Error("GROUP_NOT_FOUND");
    await transaction`DELETE FROM group_assignments WHERE group_id = ${groupId} AND assigned_date = ${date}::date AND source = 'auto'`;
    await ensureGroupAssignments(toGroup(group), await getDutyRule(groupId, transaction), date, transaction);
  });
  return getPostgresGroupsSnapshot();
}

export async function assignPostgresPersonToDutyGroup(groupId: string, personId: string, date = localDateKey(), allowConflict = false): Promise<GroupsSnapshot> {
  await inPostgresTransaction(async (transaction) => {
    await lockAssignmentDay(transaction, date, groupId, personId);
    const [group] = await transaction<Array<{ enabled: boolean }>>`SELECT enabled FROM duty_groups WHERE id = ${groupId} FOR UPDATE`;
    const [person] = await transaction<Array<{ platoonId: string }>>`SELECT platoon_id AS "platoonId" FROM people WHERE id = ${personId} FOR SHARE`;
    if (!group) throw new Error("GROUP_NOT_FOUND");
    if (!person) throw new Error("PERSON_NOT_FOUND");
    const rule = await getDutyRule(groupId, transaction);
    const dayOfWeek = dayOfWeekFromKey(date);
    const excluded = (await transaction`SELECT 1 FROM group_exclusions WHERE group_id = ${groupId} AND person_id = ${personId} AND (day_of_week IS NULL OR day_of_week = ${dayOfWeek}) LIMIT 1`).length > 0;
    const reason = groupAssignmentIneligibility({ groupEnabled: group.enabled, activeDays: rule.activeDays, dayOfWeek, enabledPlatoons: rule.enabledPlatoons, personPlatoonId: person.platoonId, excluded });
    if (reason) throw new GroupAssignmentIneligibleError(reason);
    const current = await getAssignmentsForGroupDate(groupId, date, transaction);
    if (!current.some((assignment) => assignment.personId === personId) && current.length >= rule.peoplePerDay) throw new Error("GROUP_ASSIGNMENT_OVERFILLED");
    const conflicts = await conflictRows(personId, date, groupId, transaction);
    if (conflicts.length && !allowConflict) {
      const error = new Error("GROUP_ASSIGNMENT_CONFLICT") as Error & { conflicts?: GroupConflict[] };
      error.conflicts = conflicts;
      throw error;
    }
    await writeDutyAssignment(groupId, personId, date, "manual", conflicts.length ? "warning" : "clear", transaction);
  });
  return getPostgresGroupsSnapshot();
}

export async function removePostgresDutyAssignment(assignmentId: string): Promise<GroupsSnapshot> {
  await pg()`DELETE FROM group_assignments WHERE id = ${assignmentId}`;
  return getPostgresGroupsSnapshot();
}

export async function excludePostgresPersonFromDutyGroup(groupId: string, personId: string, dayOfWeek: number | null, reason = ""): Promise<GroupsSnapshot> {
  if (dayOfWeek !== null && (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)) throw new Error("DAY_OF_WEEK_INVALID");
  await pg()`
    INSERT INTO group_exclusions (id, group_id, person_id, day_of_week, reason)
    VALUES (${randomUUID()}, ${groupId}, ${personId}, ${dayOfWeek}, ${reason.trim()}) ON CONFLICT DO NOTHING
  `;
  return refreshPostgresAutomaticDutyAssignments();
}

export async function includePostgresPersonInDutyGroup(exclusionId: string): Promise<GroupsSnapshot> {
  await pg()`DELETE FROM group_exclusions WHERE id = ${exclusionId}`;
  return refreshPostgresAutomaticDutyAssignments();
}

export async function getPostgresDutyGroupHistory(groupId?: string): Promise<GroupAssignment[]> {
  const rows = await pg()<DbAssignment[]>`
    SELECT id, group_id AS "groupId", person_id AS "personId", assigned_date AS "assignedDate", source, conflict_state AS "conflictState", created_at
    FROM group_assignments WHERE (${groupId ?? null}::text IS NULL OR group_id = ${groupId ?? null}::text)
    ORDER BY assigned_date DESC, created_at DESC LIMIT 300
  `;
  return enrichDutyAssignments(rows);
}

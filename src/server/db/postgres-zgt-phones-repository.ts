import { randomUUID } from "node:crypto";
import { inPostgresTransaction, pg } from "./postgres";
import {
  PHONES_PAGE_SIZE,
  type PhoneFormValues,
  type PhoneListResult,
  type PhoneRecord,
  type PhoneStats,
  type PhoneStatus,
} from "@/features/zgt/phones-types";

type DbPhone = {
  id: string;
  personId: string;
  personName: string | null;
  personRank: string | null;
  brand: string | null;
  model: string;
  color: string | null;
  imei1: string | null;
  imei2: string | null;
  serialNumber: string | null;
  hasCamera: boolean;
  hasVoiceRecorder: boolean;
  status: PhoneStatus;
  storageCell: string | null;
  checked_in_at: Date | null;
  checked_out_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapPhone(row: DbPhone): PhoneRecord {
  return {
    id: row.id,
    personId: row.personId,
    personName: row.personName,
    personRank: row.personRank,
    brand: row.brand,
    model: row.model,
    color: row.color,
    imei1: row.imei1,
    imei2: row.imei2,
    serialNumber: row.serialNumber,
    hasCamera: row.hasCamera,
    hasVoiceRecorder: row.hasVoiceRecorder,
    status: row.status,
    storageCell: row.storageCell,
    checkedInAt: row.checked_in_at?.getTime() ?? null,
    checkedOutAt: row.checked_out_at?.getTime() ?? null,
    createdAt: row.created_at.getTime(),
    updatedAt: row.updated_at.getTime(),
  };
}

async function assertPerson(personId: string) {
  const sql = pg();
  const rows = await sql`SELECT 1 FROM people WHERE id = ${personId}`;
  if (!rows.length) throw new Error("PERSON_NOT_FOUND");
}

export async function getPhoneStats(): Promise<PhoneStats> {
  const sql = pg();
  const rows = await sql<Array<{ status: PhoneStatus; cnt: string }>>`
    SELECT status, count(*)::text AS cnt
    FROM phones
    WHERE deleted_at IS NULL
    GROUP BY status
  `;
  const map = Object.fromEntries(rows.map((row) => [row.status, Number(row.cnt)])) as Partial<
    Record<PhoneStatus, number>
  >;
  const checkedIn = map.checked_in ?? 0;
  const checkedOut = map.checked_out ?? 0;
  return { total: checkedIn + checkedOut, checkedIn, checkedOut };
}

export async function listPhones(params: {
  q?: string;
  status?: PhoneStatus | "";
  page?: number;
} = {}): Promise<PhoneListResult> {
  const sql = pg();
  const page = Math.max(1, params.page ?? 1);
  const q = params.q?.trim() ?? "";
  const qPattern = q ? `%${q}%` : null;
  const status = params.status || null;

  const [{ total }] = await sql<Array<{ total: string }>>`
    SELECT count(*)::text AS total
    FROM phones ph
    INNER JOIN people p ON p.id = ph.person_id
    WHERE ph.deleted_at IS NULL
      AND (${qPattern}::text IS NULL OR (
        ph.model ILIKE ${qPattern}
        OR COALESCE(ph.brand, '') ILIKE ${qPattern}
        OR COALESCE(ph.imei1, '') ILIKE ${qPattern}
        OR COALESCE(ph.imei2, '') ILIKE ${qPattern}
        OR COALESCE(ph.serial_number, '') ILIKE ${qPattern}
        OR COALESCE(ph.storage_cell, '') ILIKE ${qPattern}
        OR p.name ILIKE ${qPattern}
        OR p.rank ILIKE ${qPattern}
      ))
      AND (${status}::text IS NULL OR ph.status = ${status})
  `;

  const totalNum = Number(total);
  const offset = (page - 1) * PHONES_PAGE_SIZE;
  const rows = await sql<DbPhone[]>`
    SELECT
      ph.id,
      ph.person_id AS "personId",
      p.name AS "personName",
      p.rank AS "personRank",
      ph.brand,
      ph.model,
      ph.color,
      ph.imei1,
      ph.imei2,
      ph.serial_number AS "serialNumber",
      ph.has_camera AS "hasCamera",
      ph.has_voice_recorder AS "hasVoiceRecorder",
      ph.status,
      ph.storage_cell AS "storageCell",
      ph.checked_in_at,
      ph.checked_out_at,
      ph.created_at,
      ph.updated_at
    FROM phones ph
    INNER JOIN people p ON p.id = ph.person_id
    WHERE ph.deleted_at IS NULL
      AND (${qPattern}::text IS NULL OR (
        ph.model ILIKE ${qPattern}
        OR COALESCE(ph.brand, '') ILIKE ${qPattern}
        OR COALESCE(ph.imei1, '') ILIKE ${qPattern}
        OR COALESCE(ph.imei2, '') ILIKE ${qPattern}
        OR COALESCE(ph.serial_number, '') ILIKE ${qPattern}
        OR COALESCE(ph.storage_cell, '') ILIKE ${qPattern}
        OR p.name ILIKE ${qPattern}
        OR p.rank ILIKE ${qPattern}
      ))
      AND (${status}::text IS NULL OR ph.status = ${status})
    ORDER BY p.name, ph.model, ph.id
    LIMIT ${PHONES_PAGE_SIZE}
    OFFSET ${offset}
  `;

  return {
    items: rows.map(mapPhone),
    total: totalNum,
    page,
    pageCount: Math.max(1, Math.ceil(totalNum / PHONES_PAGE_SIZE)),
    stats: await getPhoneStats(),
  };
}

export async function getPhoneById(id: string): Promise<PhoneRecord | null> {
  const sql = pg();
  const rows = await sql<DbPhone[]>`
    SELECT
      ph.id,
      ph.person_id AS "personId",
      p.name AS "personName",
      p.rank AS "personRank",
      ph.brand,
      ph.model,
      ph.color,
      ph.imei1,
      ph.imei2,
      ph.serial_number AS "serialNumber",
      ph.has_camera AS "hasCamera",
      ph.has_voice_recorder AS "hasVoiceRecorder",
      ph.status,
      ph.storage_cell AS "storageCell",
      ph.checked_in_at,
      ph.checked_out_at,
      ph.created_at,
      ph.updated_at
    FROM phones ph
    INNER JOIN people p ON p.id = ph.person_id
    WHERE ph.id = ${id} AND ph.deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0] ? mapPhone(rows[0]) : null;
}

export async function createPhone(input: PhoneFormValues, createdBy: string | null) {
  await assertPerson(input.personId);
  const id = randomUUID();
  const sql = pg();
  const checkedInAt = input.status === "checked_in" ? new Date() : null;
  const checkedOutAt = input.status === "checked_out" ? new Date() : null;
  await sql`
    INSERT INTO phones (
      id, person_id, brand, model, color, imei1, imei2, serial_number,
      has_camera, has_voice_recorder, status, storage_cell,
      checked_in_at, checked_out_at, created_by
    ) VALUES (
      ${id},
      ${input.personId},
      ${emptyToNull(input.brand)},
      ${input.model.trim()},
      ${emptyToNull(input.color)},
      ${emptyToNull(input.imei1)},
      ${emptyToNull(input.imei2)},
      ${emptyToNull(input.serialNumber)},
      ${input.hasCamera},
      ${input.hasVoiceRecorder},
      ${input.status},
      ${emptyToNull(input.storageCell)},
      ${checkedInAt},
      ${checkedOutAt},
      ${createdBy}
    )
  `;
  const item = await getPhoneById(id);
  if (!item) throw new Error("PHONE_NOT_FOUND");
  return item;
}

export async function updatePhone(id: string, input: PhoneFormValues) {
  await assertPerson(input.personId);
  return inPostgresTransaction(async (tx) => {
    const existing = await tx<Array<{ id: string; status: PhoneStatus }>>`
      SELECT id, status FROM phones WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE
    `;
    if (!existing.length) throw new Error("PHONE_NOT_FOUND");

    let checkedInAtSql: Date | null | undefined;
    let checkedOutAtSql: Date | null | undefined;
    if (existing[0].status !== input.status) {
      if (input.status === "checked_in") {
        checkedInAtSql = new Date();
      } else {
        checkedOutAtSql = new Date();
      }
    }

    await tx`
      UPDATE phones SET
        person_id = ${input.personId},
        brand = ${emptyToNull(input.brand)},
        model = ${input.model.trim()},
        color = ${emptyToNull(input.color)},
        imei1 = ${emptyToNull(input.imei1)},
        imei2 = ${emptyToNull(input.imei2)},
        serial_number = ${emptyToNull(input.serialNumber)},
        has_camera = ${input.hasCamera},
        has_voice_recorder = ${input.hasVoiceRecorder},
        status = ${input.status},
        storage_cell = ${emptyToNull(input.storageCell)},
        checked_in_at = CASE
          WHEN ${input.status} = 'checked_in' AND ${existing[0].status} <> 'checked_in'
            THEN now()
          WHEN ${input.status} = 'checked_out' THEN checked_in_at
          ELSE checked_in_at
        END,
        checked_out_at = CASE
          WHEN ${input.status} = 'checked_out' AND ${existing[0].status} <> 'checked_out'
            THEN now()
          ELSE checked_out_at
        END,
        updated_at = now()
      WHERE id = ${id}
    `;

    void checkedInAtSql;
    void checkedOutAtSql;

    const item = await getPhoneById(id);
    if (!item) throw new Error("PHONE_NOT_FOUND");
    return item;
  });
}

export async function softDeletePhone(id: string) {
  const sql = pg();
  const rows = await sql`
    UPDATE phones SET deleted_at = now(), updated_at = now()
    WHERE id = ${id} AND deleted_at IS NULL
    RETURNING id
  `;
  if (!rows.length) throw new Error("PHONE_NOT_FOUND");
}

export async function batchCheckInPhones(input: {
  ids: string[];
  storageCell?: string | null;
}) {
  const ids = [...new Set(input.ids)];
  return inPostgresTransaction(async (tx) => {
    const sql = pg();
    const current = await tx<Array<{ id: string }>>`
      SELECT id FROM phones
      WHERE id = ANY(${sql.array(ids)}) AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (current.length !== ids.length) throw new Error("PHONE_NOT_FOUND");
    await tx`
      UPDATE phones SET
        status = 'checked_in',
        storage_cell = COALESCE(${emptyToNull(input.storageCell ?? null)}, storage_cell),
        checked_in_at = now(),
        updated_at = now()
      WHERE id = ANY(${sql.array(ids)})
    `;
    return { affected: current.length };
  });
}

export async function batchCheckOutPhones(input: { ids: string[] }) {
  const ids = [...new Set(input.ids)];
  return inPostgresTransaction(async (tx) => {
    const sql = pg();
    const current = await tx<Array<{ id: string }>>`
      SELECT id FROM phones
      WHERE id = ANY(${sql.array(ids)}) AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (current.length !== ids.length) throw new Error("PHONE_NOT_FOUND");
    await tx`
      UPDATE phones SET
        status = 'checked_out',
        storage_cell = NULL,
        checked_out_at = now(),
        updated_at = now()
      WHERE id = ANY(${sql.array(ids)})
    `;
    return { affected: current.length };
  });
}

import { randomUUID } from "node:crypto";
import { inPostgresTransaction, pg } from "./postgres";
import {
  STORAGE_ITEMS_PAGE_SIZE,
  type StorageItemFormValues,
  type StorageItemListResult,
  type StorageItemRecord,
  type StorageItemStats,
  type StorageItemStatus,
  type StorageItemType,
} from "@/features/zgt/storage-items-types";

type DbItem = {
  id: string;
  type: StorageItemType;
  inventoryNumber: string | null;
  serialNumber: string | null;
  capacityGb: number | null;
  accessLevel: number | null;
  status: StorageItemStatus;
  personId: string | null;
  personName: string | null;
  personRank: string | null;
  issued_at: Date | null;
  returned_at: Date | null;
  notes: string;
  created_at: Date;
  updated_at: Date;
};

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapItem(row: DbItem): StorageItemRecord {
  return {
    id: row.id,
    type: row.type,
    inventoryNumber: row.inventoryNumber,
    serialNumber: row.serialNumber,
    capacityGb: row.capacityGb,
    accessLevel: row.accessLevel,
    status: row.status,
    personId: row.personId,
    personName: row.personName,
    personRank: row.personRank,
    issuedAt: row.issued_at?.getTime() ?? null,
    returnedAt: row.returned_at?.getTime() ?? null,
    notes: row.notes,
    createdAt: row.created_at.getTime(),
    updatedAt: row.updated_at.getTime(),
  };
}

async function assertPersonOptional(personId: string | null) {
  if (!personId) return;
  const sql = pg();
  const rows = await sql`SELECT 1 FROM people WHERE id = ${personId}`;
  if (!rows.length) throw new Error("PERSON_NOT_FOUND");
}

export async function getStorageItemStats(): Promise<StorageItemStats> {
  const sql = pg();
  const rows = await sql<Array<{ status: StorageItemStatus; cnt: string }>>`
    SELECT status, count(*)::text AS cnt
    FROM storage_items
    WHERE deleted_at IS NULL
    GROUP BY status
  `;
  const map = Object.fromEntries(rows.map((row) => [row.status, Number(row.cnt)])) as Partial<
    Record<StorageItemStatus, number>
  >;
  const stock = map.stock ?? 0;
  const inUse = map.in_use ?? 0;
  const broken = map.broken ?? 0;
  const lost = map.lost ?? 0;
  return { total: stock + inUse + broken + lost, stock, inUse, broken, lost };
}

export async function listStorageItems(params: {
  q?: string;
  status?: StorageItemStatus | "";
  type?: StorageItemType | "";
  page?: number;
} = {}): Promise<StorageItemListResult> {
  const sql = pg();
  const page = Math.max(1, params.page ?? 1);
  const q = params.q?.trim() ?? "";
  const qPattern = q ? `%${q}%` : null;
  const status = params.status || null;
  const type = params.type || null;

  const [{ total }] = await sql<Array<{ total: string }>>`
    SELECT count(*)::text AS total
    FROM storage_items si
    LEFT JOIN people p ON p.id = si.person_id
    WHERE si.deleted_at IS NULL
      AND (${qPattern}::text IS NULL OR (
        COALESCE(si.inventory_number, '') ILIKE ${qPattern}
        OR COALESCE(si.serial_number, '') ILIKE ${qPattern}
        OR COALESCE(si.notes, '') ILIKE ${qPattern}
        OR COALESCE(p.name, '') ILIKE ${qPattern}
      ))
      AND (${status}::text IS NULL OR si.status = ${status})
      AND (${type}::text IS NULL OR si.type = ${type})
  `;

  const totalNum = Number(total);
  const offset = (page - 1) * STORAGE_ITEMS_PAGE_SIZE;
  const rows = await sql<DbItem[]>`
    SELECT
      si.id,
      si.type,
      si.inventory_number AS "inventoryNumber",
      si.serial_number AS "serialNumber",
      si.capacity_gb AS "capacityGb",
      si.access_level AS "accessLevel",
      si.status,
      si.person_id AS "personId",
      p.name AS "personName",
      p.rank AS "personRank",
      si.issued_at,
      si.returned_at,
      si.notes,
      si.created_at,
      si.updated_at
    FROM storage_items si
    LEFT JOIN people p ON p.id = si.person_id
    WHERE si.deleted_at IS NULL
      AND (${qPattern}::text IS NULL OR (
        COALESCE(si.inventory_number, '') ILIKE ${qPattern}
        OR COALESCE(si.serial_number, '') ILIKE ${qPattern}
        OR COALESCE(si.notes, '') ILIKE ${qPattern}
        OR COALESCE(p.name, '') ILIKE ${qPattern}
      ))
      AND (${status}::text IS NULL OR si.status = ${status})
      AND (${type}::text IS NULL OR si.type = ${type})
    ORDER BY si.type, si.inventory_number NULLS LAST, si.id
    LIMIT ${STORAGE_ITEMS_PAGE_SIZE}
    OFFSET ${offset}
  `;

  return {
    items: rows.map(mapItem),
    total: totalNum,
    page,
    pageCount: Math.max(1, Math.ceil(totalNum / STORAGE_ITEMS_PAGE_SIZE)),
    stats: await getStorageItemStats(),
  };
}

export async function getStorageItemById(id: string): Promise<StorageItemRecord | null> {
  const sql = pg();
  const rows = await sql<DbItem[]>`
    SELECT
      si.id,
      si.type,
      si.inventory_number AS "inventoryNumber",
      si.serial_number AS "serialNumber",
      si.capacity_gb AS "capacityGb",
      si.access_level AS "accessLevel",
      si.status,
      si.person_id AS "personId",
      p.name AS "personName",
      p.rank AS "personRank",
      si.issued_at,
      si.returned_at,
      si.notes,
      si.created_at,
      si.updated_at
    FROM storage_items si
    LEFT JOIN people p ON p.id = si.person_id
    WHERE si.id = ${id} AND si.deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0] ? mapItem(rows[0]) : null;
}

export async function createStorageItem(
  input: StorageItemFormValues,
  createdBy: string | null,
) {
  const personId = input.personId ?? null;
  await assertPersonOptional(personId);
  const id = randomUUID();
  const status =
    personId && input.status === "stock" ? "in_use" : input.status;
  const sql = pg();
  await sql`
    INSERT INTO storage_items (
      id, type, inventory_number, serial_number, capacity_gb, access_level,
      status, person_id, issued_at, notes, created_by
    ) VALUES (
      ${id},
      ${input.type},
      ${emptyToNull(input.inventoryNumber)},
      ${emptyToNull(input.serialNumber)},
      ${input.capacityGb ?? null},
      ${input.accessLevel ?? null},
      ${status},
      ${personId},
      ${personId ? new Date() : null},
      ${input.notes?.trim() ?? ""},
      ${createdBy}
    )
  `;
  const item = await getStorageItemById(id);
  if (!item) throw new Error("STORAGE_ITEM_NOT_FOUND");
  return item;
}

export async function updateStorageItem(id: string, input: StorageItemFormValues) {
  const personId = input.personId ?? null;
  await assertPersonOptional(personId);
  return inPostgresTransaction(async (tx) => {
    const existing = await tx<Array<{ id: string }>>`
      SELECT id FROM storage_items WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE
    `;
    if (!existing.length) throw new Error("STORAGE_ITEM_NOT_FOUND");

    await tx`
      UPDATE storage_items SET
        type = ${input.type},
        inventory_number = ${emptyToNull(input.inventoryNumber)},
        serial_number = ${emptyToNull(input.serialNumber)},
        capacity_gb = ${input.capacityGb ?? null},
        access_level = ${input.accessLevel ?? null},
        status = ${input.status},
        person_id = ${personId},
        issued_at = CASE
          WHEN ${personId}::text IS NOT NULL AND person_id IS DISTINCT FROM ${personId}
            THEN now()
          WHEN ${personId}::text IS NULL THEN issued_at
          ELSE issued_at
        END,
        returned_at = CASE
          WHEN ${personId}::text IS NULL AND person_id IS NOT NULL THEN now()
          ELSE returned_at
        END,
        notes = ${input.notes?.trim() ?? ""},
        updated_at = now()
      WHERE id = ${id}
    `;

    const item = await getStorageItemById(id);
    if (!item) throw new Error("STORAGE_ITEM_NOT_FOUND");
    return item;
  });
}

export async function softDeleteStorageItem(id: string) {
  const sql = pg();
  const rows = await sql`
    UPDATE storage_items SET deleted_at = now(), updated_at = now()
    WHERE id = ${id} AND deleted_at IS NULL
    RETURNING id
  `;
  if (!rows.length) throw new Error("STORAGE_ITEM_NOT_FOUND");
}

export async function batchIssueStorageItems(input: {
  ids: string[];
  toPersonId: string;
}) {
  await assertPersonOptional(input.toPersonId);
  const ids = [...new Set(input.ids)];
  return inPostgresTransaction(async (tx) => {
    const sql = pg();
    const current = await tx<Array<{ id: string }>>`
      SELECT id FROM storage_items
      WHERE id = ANY(${sql.array(ids)}) AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (current.length !== ids.length) throw new Error("STORAGE_ITEM_NOT_FOUND");
    await tx`
      UPDATE storage_items SET
        status = 'in_use',
        person_id = ${input.toPersonId},
        issued_at = now(),
        returned_at = NULL,
        updated_at = now()
      WHERE id = ANY(${sql.array(ids)})
    `;
    return { affected: current.length };
  });
}

export async function batchReturnStorageItems(input: { ids: string[] }) {
  const ids = [...new Set(input.ids)];
  return inPostgresTransaction(async (tx) => {
    const sql = pg();
    const current = await tx<Array<{ id: string }>>`
      SELECT id FROM storage_items
      WHERE id = ANY(${sql.array(ids)}) AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (current.length !== ids.length) throw new Error("STORAGE_ITEM_NOT_FOUND");
    await tx`
      UPDATE storage_items SET
        status = 'stock',
        person_id = NULL,
        returned_at = now(),
        updated_at = now()
      WHERE id = ANY(${sql.array(ids)})
    `;
    return { affected: current.length };
  });
}

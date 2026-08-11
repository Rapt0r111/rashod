import { randomUUID } from "node:crypto";
import { inPostgresTransaction, pg } from "./postgres";
import {
  DEVICE_TYPES,
  deviceTypeToCategory,
  EQUIPMENT_PAGE_SIZE,
  type DeviceTypeValue,
  type EquipmentDetail,
  type EquipmentFormValues,
  type EquipmentListResult,
  type EquipmentRecord,
  type EquipmentStats,
  type EquipmentStatus,
  type EquipmentTransferRecord,
  type PersonPickerItem,
  type StorageDeviceRecord,
  type TransferType,
} from "@/features/zgt/types";

type DbEquipment = {
  id: string;
  category: EquipmentRecord["category"];
  deviceType: DeviceTypeValue;
  isPersonal: boolean;
  displayName: string;
  inventoryNumber: string | null;
  serialNumber: string | null;
  mniSerialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  cpu: string | null;
  ramGb: number | null;
  storageType: string | null;
  storageGb: number | null;
  os: string | null;
  hasCharger: boolean | null;
  hasMouse: boolean | null;
  hasBag: boolean | null;
  isChargerWorking: boolean | null;
  isMouseWorking: boolean | null;
  isWorking: boolean;
  personId: string | null;
  personName: string | null;
  personRank: string | null;
  location: string | null;
  status: EquipmentStatus;
  created_at: Date;
  updated_at: Date;
};

type DbTransfer = {
  id: string;
  equipmentId: string;
  type: TransferType;
  fromPersonId: string | null;
  toPersonId: string | null;
  fromPersonName: string | null;
  toPersonName: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  documentRef: string | null;
  notes: string | null;
  transferred_at: Date;
  createdByName: string | null;
};

type DbStorage = {
  id: string;
  equipmentId: string;
  manufacturer: string | null;
  model: string | null;
  inventoryNumber: string | null;
  serialNumber: string;
  capacityGb: number;
  interface: string | null;
  type: string | null;
};

function mapEquipment(row: DbEquipment): EquipmentRecord {
  return {
    id: row.id,
    category: row.category,
    deviceType: row.deviceType,
    isPersonal: row.isPersonal,
    displayName: row.displayName,
    inventoryNumber: row.inventoryNumber,
    serialNumber: row.serialNumber,
    mniSerialNumber: row.mniSerialNumber,
    manufacturer: row.manufacturer,
    model: row.model,
    cpu: row.cpu,
    ramGb: row.ramGb,
    storageType: row.storageType,
    storageGb: row.storageGb,
    os: row.os,
    hasCharger: row.hasCharger,
    hasMouse: row.hasMouse,
    hasBag: row.hasBag,
    isChargerWorking: row.isChargerWorking,
    isMouseWorking: row.isMouseWorking,
    isWorking: row.isWorking,
    personId: row.personId,
    personName: row.personName,
    personRank: row.personRank,
    location: row.location,
    status: row.status,
    createdAt: row.created_at.getTime(),
    updatedAt: row.updated_at.getTime(),
  };
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function searchPeopleForZgt(query: string, limit = 20): Promise<PersonPickerItem[]> {
  const sql = pg();
  const term = query.trim();
  const pattern = term ? `%${term}%` : null;
  const rows = await sql<PersonPickerItem[]>`
    SELECT
      p.id,
      p.name,
      p.rank,
      pl.label AS "platoonLabel",
      p.conscription_number AS "conscriptionNumber",
      p.location,
      loc.label AS "locationLabel",
      pp.position,
      pp.unit
    FROM people p
    LEFT JOIN platoons pl ON pl.id = p.platoon_id
    LEFT JOIN locations loc ON loc.key = p.location
    LEFT JOIN personnel_profiles pp ON pp.person_id = p.id
    WHERE (
      ${pattern}::text IS NULL
      OR p.name ILIKE ${pattern}
      OR p.rank ILIKE ${pattern}
      OR COALESCE(p.conscription_number, '') ILIKE ${pattern}
      OR COALESCE(pp.position, '') ILIKE ${pattern}
      OR COALESCE(pp.unit, '') ILIKE ${pattern}
      OR COALESCE(pp.last_name, '') ILIKE ${pattern}
      OR COALESCE(pp.first_name, '') ILIKE ${pattern}
      OR COALESCE(loc.label, '') ILIKE ${pattern}
    )
    ORDER BY p.sort_order, p.name
    LIMIT ${Math.min(Math.max(limit, 1), 50)}
  `;
  return rows;
}

export async function upsertPersonnelProfile(input: {
  personId: string;
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  position?: string | null;
  unit?: string | null;
  notes?: string;
}) {
  const sql = pg();
  const exists = await sql`SELECT 1 FROM people WHERE id = ${input.personId}`;
  if (!exists.length) throw new Error("PERSON_NOT_FOUND");
  await sql`
    INSERT INTO personnel_profiles (
      person_id, last_name, first_name, middle_name, position, unit, notes
    ) VALUES (
      ${input.personId},
      ${emptyToNull(input.lastName ?? null)},
      ${emptyToNull(input.firstName ?? null)},
      ${emptyToNull(input.middleName ?? null)},
      ${emptyToNull(input.position ?? null)},
      ${emptyToNull(input.unit ?? null)},
      ${input.notes?.trim() ?? ""}
    )
    ON CONFLICT (person_id) DO UPDATE SET
      last_name = EXCLUDED.last_name,
      first_name = EXCLUDED.first_name,
      middle_name = EXCLUDED.middle_name,
      position = EXCLUDED.position,
      unit = EXCLUDED.unit,
      notes = EXCLUDED.notes,
      updated_at = now()
  `;
}

export async function getEquipmentStats(): Promise<EquipmentStats> {
  const sql = pg();
  const rows = await sql<Array<{ status: EquipmentStatus; cnt: string }>>`
    SELECT status, count(*)::text AS cnt
    FROM equipment
    WHERE deleted_at IS NULL AND is_personal = false
    GROUP BY status
  `;
  const map = Object.fromEntries(rows.map((row) => [row.status, Number(row.cnt)])) as Partial<
    Record<EquipmentStatus, number>
  >;
  const inUse = map.in_use ?? 0;
  const storage = map.storage ?? 0;
  const repair = map.repair ?? 0;
  const broken = map.broken ?? 0;
  return { total: inUse + storage + repair + broken, inUse, storage, repair, broken };
}

export async function getDistinctEquipmentLocations(): Promise<string[]> {
  const sql = pg();
  const rows = await sql<Array<{ location: string }>>`
    SELECT DISTINCT location
    FROM equipment
    WHERE deleted_at IS NULL
      AND location IS NOT NULL
      AND location <> ''
    ORDER BY location
  `;
  return rows.map((row) => row.location);
}

export async function listEquipment(params: {
  q?: string;
  status?: EquipmentStatus | "";
  category?: string;
  location?: string;
  page?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
} = {}): Promise<EquipmentListResult> {
  const sql = pg();
  const page = Math.max(1, params.page ?? 1);
  const sortDir = params.sortDir === "desc" ? "DESC" : "ASC";
  const orderColumns: Record<string, string> = {
    inventoryNumber: "e.inventory_number",
    status: "e.status",
    category: "e.category",
    location: "e.location",
    createdAt: "e.created_at",
    displayName: "e.display_name",
  };
  const orderColumn = orderColumns[params.sortBy ?? "displayName"] ?? "e.display_name";

  const q = params.q?.trim() ?? "";
  const qPattern = q ? `%${q}%` : null;
  const status = params.status || null;
  const category = params.category || null;
  const locationPattern = params.location?.trim()
    ? `%${params.location.trim()}%`
    : null;

  const [{ total }] = await sql<Array<{ total: string }>>`
    SELECT count(*)::text AS total
    FROM equipment e
    LEFT JOIN people p ON p.id = e.person_id
    WHERE e.deleted_at IS NULL
      AND e.is_personal = false
      AND (${qPattern}::text IS NULL OR (
        e.display_name ILIKE ${qPattern}
        OR COALESCE(e.inventory_number, '') ILIKE ${qPattern}
        OR COALESCE(e.serial_number, '') ILIKE ${qPattern}
        OR COALESCE(e.manufacturer, '') ILIKE ${qPattern}
        OR COALESCE(e.model, '') ILIKE ${qPattern}
        OR COALESCE(e.location, '') ILIKE ${qPattern}
        OR COALESCE(p.name, '') ILIKE ${qPattern}
      ))
      AND (${status}::text IS NULL OR e.status = ${status})
      AND (${category}::text IS NULL OR e.category = ${category})
      AND (${locationPattern}::text IS NULL OR COALESCE(e.location, '') ILIKE ${locationPattern})
  `;

  const totalNum = Number(total);
  const offset = (page - 1) * EQUIPMENT_PAGE_SIZE;

  const rows = await sql.unsafe<DbEquipment[]>(
    `
    SELECT
      e.id,
      e.category,
      e.device_type AS "deviceType",
      e.is_personal AS "isPersonal",
      e.display_name AS "displayName",
      e.inventory_number AS "inventoryNumber",
      e.serial_number AS "serialNumber",
      e.mni_serial_number AS "mniSerialNumber",
      e.manufacturer,
      e.model,
      e.cpu,
      e.ram_gb AS "ramGb",
      e.storage_type AS "storageType",
      e.storage_gb AS "storageGb",
      e.os,
      e.has_charger AS "hasCharger",
      e.has_mouse AS "hasMouse",
      e.has_bag AS "hasBag",
      e.is_charger_working AS "isChargerWorking",
      e.is_mouse_working AS "isMouseWorking",
      e.is_working AS "isWorking",
      e.person_id AS "personId",
      p.name AS "personName",
      p.rank AS "personRank",
      e.location,
      e.status,
      e.created_at,
      e.updated_at
    FROM equipment e
    LEFT JOIN people p ON p.id = e.person_id
    WHERE e.deleted_at IS NULL
      AND e.is_personal = false
      AND ($1::text IS NULL OR (
        e.display_name ILIKE $1
        OR COALESCE(e.inventory_number, '') ILIKE $1
        OR COALESCE(e.serial_number, '') ILIKE $1
        OR COALESCE(e.manufacturer, '') ILIKE $1
        OR COALESCE(e.model, '') ILIKE $1
        OR COALESCE(e.location, '') ILIKE $1
        OR COALESCE(p.name, '') ILIKE $1
      ))
      AND ($2::text IS NULL OR e.status = $2)
      AND ($3::text IS NULL OR e.category = $3)
      AND ($4::text IS NULL OR COALESCE(e.location, '') ILIKE $4)
    ORDER BY ${orderColumn} ${sortDir} NULLS LAST, e.display_name ASC
    LIMIT $5
    OFFSET $6
    `,
    [qPattern, status, category, locationPattern, EQUIPMENT_PAGE_SIZE, offset],
  );

  const [stats, locations] = await Promise.all([
    getEquipmentStats(),
    getDistinctEquipmentLocations(),
  ]);

  return {
    items: rows.map(mapEquipment),
    total: totalNum,
    page,
    pageCount: Math.max(1, Math.ceil(totalNum / EQUIPMENT_PAGE_SIZE)),
    stats,
    locations,
  };
}

export async function getEquipmentById(id: string): Promise<EquipmentDetail | null> {
  const sql = pg();
  const rows = await sql<DbEquipment[]>`
    SELECT
      e.id,
      e.category,
      e.device_type AS "deviceType",
      e.is_personal AS "isPersonal",
      e.display_name AS "displayName",
      e.inventory_number AS "inventoryNumber",
      e.serial_number AS "serialNumber",
      e.mni_serial_number AS "mniSerialNumber",
      e.manufacturer,
      e.model,
      e.cpu,
      e.ram_gb AS "ramGb",
      e.storage_type AS "storageType",
      e.storage_gb AS "storageGb",
      e.os,
      e.has_charger AS "hasCharger",
      e.has_mouse AS "hasMouse",
      e.has_bag AS "hasBag",
      e.is_charger_working AS "isChargerWorking",
      e.is_mouse_working AS "isMouseWorking",
      e.is_working AS "isWorking",
      e.person_id AS "personId",
      p.name AS "personName",
      p.rank AS "personRank",
      e.location,
      e.status,
      e.created_at,
      e.updated_at
    FROM equipment e
    LEFT JOIN people p ON p.id = e.person_id
    WHERE e.id = ${id} AND e.deleted_at IS NULL
    LIMIT 1
  `;
  if (!rows[0]) return null;

  const [storage, transfers] = await Promise.all([
    sql<DbStorage[]>`
      SELECT
        id,
        equipment_id AS "equipmentId",
        manufacturer,
        model,
        inventory_number AS "inventoryNumber",
        serial_number AS "serialNumber",
        capacity_gb AS "capacityGb",
        interface,
        type
      FROM storage_devices
      WHERE equipment_id = ${id} AND deleted_at IS NULL
      ORDER BY created_at, id
    `,
    sql<DbTransfer[]>`
      SELECT
        t.id,
        t.equipment_id AS "equipmentId",
        t.type,
        t.from_person_id AS "fromPersonId",
        t.to_person_id AS "toPersonId",
        fp.name AS "fromPersonName",
        tp.name AS "toPersonName",
        t.from_location AS "fromLocation",
        t.to_location AS "toLocation",
        t.document_ref AS "documentRef",
        t.notes,
        t.transferred_at,
        u.display_name AS "createdByName"
      FROM equipment_transfers t
      LEFT JOIN people fp ON fp.id = t.from_person_id
      LEFT JOIN people tp ON tp.id = t.to_person_id
      LEFT JOIN users u ON u.id = t.created_by
      WHERE t.equipment_id = ${id}
      ORDER BY t.transferred_at DESC
      LIMIT 100
    `,
  ]);

  return {
    ...mapEquipment(rows[0]),
    storageDevices: storage.map(
      (row): StorageDeviceRecord => ({
        id: row.id,
        equipmentId: row.equipmentId,
        manufacturer: row.manufacturer,
        model: row.model,
        inventoryNumber: row.inventoryNumber,
        serialNumber: row.serialNumber,
        capacityGb: row.capacityGb,
        interface: row.interface,
        type: row.type,
      }),
    ),
    transfers: transfers.map(
      (row): EquipmentTransferRecord => ({
        id: row.id,
        equipmentId: row.equipmentId,
        type: row.type,
        fromPersonId: row.fromPersonId,
        toPersonId: row.toPersonId,
        fromPersonName: row.fromPersonName,
        toPersonName: row.toPersonName,
        fromLocation: row.fromLocation,
        toLocation: row.toLocation,
        documentRef: row.documentRef,
        notes: row.notes,
        transferredAt: row.transferred_at.getTime(),
        createdByName: row.createdByName,
      }),
    ),
  };
}

async function assertPersonOptional(personId: string | null) {
  if (!personId) return;
  const sql = pg();
  const rows = await sql`SELECT 1 FROM people WHERE id = ${personId}`;
  if (!rows.length) throw new Error("PERSON_NOT_FOUND");
}

export async function createEquipment(
  input: EquipmentFormValues,
  createdBy: string | null,
): Promise<EquipmentRecord> {
  const id = randomUUID();
  const category = deviceTypeToCategory(input.deviceType);
  const personId = input.personId ?? null;
  await assertPersonOptional(personId);

  return inPostgresTransaction(async (tx) => {
    try {
      await tx`
        INSERT INTO equipment (
          id, category, device_type, is_personal, display_name, inventory_number, serial_number,
          mni_serial_number, manufacturer, model, cpu, ram_gb, storage_type, storage_gb, os,
          has_charger, has_mouse, has_bag, is_charger_working, is_mouse_working, is_working,
          person_id, location, status, created_by
        ) VALUES (
          ${id},
          ${category},
          ${input.deviceType},
          false,
          ${input.displayName.trim()},
          ${emptyToNull(input.inventoryNumber)},
          ${emptyToNull(input.serialNumber)},
          ${emptyToNull(input.mniSerialNumber)},
          ${emptyToNull(input.manufacturer)},
          ${emptyToNull(input.model)},
          ${emptyToNull(input.cpu)},
          ${input.ramGb ?? null},
          ${input.storageType ?? null},
          ${input.storageGb ?? null},
          ${emptyToNull(input.os)},
          ${input.hasCharger ?? null},
          ${input.hasMouse ?? null},
          ${input.hasBag ?? null},
          ${input.isChargerWorking ?? null},
          ${input.isMouseWorking ?? null},
          ${input.isWorking},
          ${personId},
          ${emptyToNull(input.location)},
          ${input.status},
          ${createdBy}
        )
      `;
    } catch (error) {
      if (String(error).includes("equipment_inventory_number_unique_idx")) {
        throw new Error("INVENTORY_NUMBER_EXISTS");
      }
      throw error;
    }

    if (personId && input.status === "in_use") {
      await tx`
        INSERT INTO equipment_transfers (
          id, equipment_id, type, to_person_id, to_location, notes, created_by
        ) VALUES (
          ${randomUUID()}, ${id}, 'issued', ${personId},
          ${emptyToNull(input.location)}, 'Первичная выдача при создании', ${createdBy}
        )
      `;
    }

    const detail = await getEquipmentById(id);
    if (!detail) throw new Error("EQUIPMENT_NOT_FOUND");
    return detail;
  });
}

export async function updateEquipment(
  id: string,
  input: EquipmentFormValues,
): Promise<EquipmentRecord> {
  const personId = input.personId ?? null;
  await assertPersonOptional(personId);
  const category = deviceTypeToCategory(input.deviceType);

  return inPostgresTransaction(async (tx) => {
    const existing = await tx<Array<{ id: string }>>`
      SELECT id FROM equipment WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE
    `;
    if (!existing.length) throw new Error("EQUIPMENT_NOT_FOUND");

    try {
      await tx`
        UPDATE equipment SET
          category = ${category},
          device_type = ${input.deviceType},
          display_name = ${input.displayName.trim()},
          inventory_number = ${emptyToNull(input.inventoryNumber)},
          serial_number = ${emptyToNull(input.serialNumber)},
          mni_serial_number = ${emptyToNull(input.mniSerialNumber)},
          manufacturer = ${emptyToNull(input.manufacturer)},
          model = ${emptyToNull(input.model)},
          cpu = ${emptyToNull(input.cpu)},
          ram_gb = ${input.ramGb ?? null},
          storage_type = ${input.storageType ?? null},
          storage_gb = ${input.storageGb ?? null},
          os = ${emptyToNull(input.os)},
          has_charger = ${input.hasCharger ?? null},
          has_mouse = ${input.hasMouse ?? null},
          has_bag = ${input.hasBag ?? null},
          is_charger_working = ${input.isChargerWorking ?? null},
          is_mouse_working = ${input.isMouseWorking ?? null},
          is_working = ${input.isWorking},
          person_id = ${personId},
          location = ${emptyToNull(input.location)},
          status = ${input.status},
          updated_at = now()
        WHERE id = ${id}
      `;
    } catch (error) {
      if (String(error).includes("equipment_inventory_number_unique_idx")) {
        throw new Error("INVENTORY_NUMBER_EXISTS");
      }
      throw error;
    }

    const detail = await getEquipmentById(id);
    if (!detail) throw new Error("EQUIPMENT_NOT_FOUND");
    return detail;
  });
}

export async function softDeleteEquipment(id: string) {
  const sql = pg();
  const rows = await sql`
    UPDATE equipment
    SET deleted_at = now(), updated_at = now()
    WHERE id = ${id} AND deleted_at IS NULL
    RETURNING id
  `;
  if (!rows.length) throw new Error("EQUIPMENT_NOT_FOUND");
}

export async function batchIssueEquipment(input: {
  ids: string[];
  toPersonId?: string | null;
  toLocation?: string | null;
  documentRef?: string | null;
  notes?: string | null;
  createdBy: string | null;
}) {
  const ids = [...new Set(input.ids)];
  await assertPersonOptional(input.toPersonId ?? null);

  return inPostgresTransaction(async (tx) => {
    const sql = pg();
    const current = await tx<Array<{ id: string; personId: string | null; location: string | null }>>`
      SELECT id, person_id AS "personId", location
      FROM equipment
      WHERE id = ANY(${sql.array(ids)}) AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (current.length !== ids.length) throw new Error("EQUIPMENT_NOT_FOUND");

    await tx`
      UPDATE equipment
      SET
        status = 'in_use',
        person_id = ${input.toPersonId ?? null},
        location = COALESCE(${emptyToNull(input.toLocation ?? null)}, location),
        updated_at = now()
      WHERE id = ANY(${sql.array(ids)})
    `;

    for (const item of current) {
      await tx`
        INSERT INTO equipment_transfers (
          id, equipment_id, type, from_person_id, to_person_id,
          from_location, to_location, document_ref, notes, created_by
        ) VALUES (
          ${randomUUID()},
          ${item.id},
          'issued',
          ${item.personId},
          ${input.toPersonId ?? null},
          ${item.location},
          ${emptyToNull(input.toLocation ?? null) ?? item.location},
          ${emptyToNull(input.documentRef ?? null)},
          ${emptyToNull(input.notes ?? null)},
          ${input.createdBy}
        )
      `;
    }

    return { affected: current.length };
  });
}

export async function batchReturnEquipment(input: {
  ids: string[];
  documentRef?: string | null;
  notes?: string | null;
  createdBy: string | null;
}) {
  const ids = [...new Set(input.ids)];
  return inPostgresTransaction(async (tx) => {
    const sql = pg();
    const current = await tx<Array<{ id: string; personId: string | null; location: string | null }>>`
      SELECT id, person_id AS "personId", location
      FROM equipment
      WHERE id = ANY(${sql.array(ids)}) AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (current.length !== ids.length) throw new Error("EQUIPMENT_NOT_FOUND");

    await tx`
      UPDATE equipment
      SET status = 'storage', person_id = NULL, updated_at = now()
      WHERE id = ANY(${sql.array(ids)})
    `;

    for (const item of current) {
      await tx`
        INSERT INTO equipment_transfers (
          id, equipment_id, type, from_person_id, from_location,
          document_ref, notes, created_by
        ) VALUES (
          ${randomUUID()},
          ${item.id},
          'returned',
          ${item.personId},
          ${item.location},
          ${emptyToNull(input.documentRef ?? null)},
          ${emptyToNull(input.notes ?? null)},
          ${input.createdBy}
        )
      `;
    }

    return { affected: current.length };
  });
}

export async function batchMoveEquipment(input: {
  ids: string[];
  toLocation: string;
  notes?: string | null;
  createdBy: string | null;
}) {
  const ids = [...new Set(input.ids)];
  const toLocation = input.toLocation.trim();
  if (!toLocation) throw new Error("LOCATION_REQUIRED");

  return inPostgresTransaction(async (tx) => {
    const sql = pg();
    const current = await tx<Array<{ id: string; location: string | null }>>`
      SELECT id, location
      FROM equipment
      WHERE id = ANY(${sql.array(ids)}) AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (current.length !== ids.length) throw new Error("EQUIPMENT_NOT_FOUND");

    await tx`
      UPDATE equipment
      SET location = ${toLocation}, updated_at = now()
      WHERE id = ANY(${sql.array(ids)})
    `;

    for (const item of current) {
      await tx`
        INSERT INTO equipment_transfers (
          id, equipment_id, type, from_location, to_location, notes, created_by
        ) VALUES (
          ${randomUUID()},
          ${item.id},
          'issued',
          ${item.location},
          ${toLocation},
          ${input.notes?.trim() ? `Перемещение. ${input.notes.trim()}` : "Перемещение"},
          ${input.createdBy}
        )
      `;
    }

    return { affected: current.length };
  });
}

export function validateDeviceType(value: string): value is DeviceTypeValue {
  return DEVICE_TYPES.some((item) => item.value === value);
}

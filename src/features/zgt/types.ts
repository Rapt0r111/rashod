import { z } from "zod";

export const DEVICE_TYPES = [
  { value: "pevm", label: "ПЭВМ", category: "workstation" },
  { value: "arm", label: "АРМ", category: "workstation" },
  { value: "laptop", label: "Ноутбук", category: "laptop" },
  { value: "server", label: "Сервер", category: "server" },
  { value: "other", label: "Прочее", category: "other" },
] as const;

export type DeviceTypeValue = (typeof DEVICE_TYPES)[number]["value"];
export type EquipmentCategory = (typeof DEVICE_TYPES)[number]["category"];

export const EQUIPMENT_STATUSES = [
  { value: "in_use", label: "В работе", tone: "green" },
  { value: "storage", label: "На складе", tone: "blue" },
  { value: "repair", label: "В ремонте", tone: "amber" },
  { value: "broken", label: "Сломан", tone: "red" },
] as const;

export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number]["value"];

export const TRANSFER_TYPES = [
  { value: "issued", label: "Выдача" },
  { value: "returned", label: "Возврат" },
  { value: "sent_repair", label: "Сдан в ремонт" },
  { value: "returned_repair", label: "Возвращён из ремонта" },
  { value: "written_off", label: "Списан" },
] as const;

export type TransferType = (typeof TRANSFER_TYPES)[number]["value"];

export const EQUIPMENT_PAGE_SIZE = 25;

export type PersonnelProfile = {
  personId: string;
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
  position: string | null;
  unit: string | null;
  notes: string;
};

/** Person for ZГТ pickers — status is people.location (Расход SoT). */
export type PersonPickerItem = {
  id: string;
  name: string;
  rank: string;
  platoonLabel: string | null;
  conscriptionNumber: string | null;
  location: string;
  locationLabel: string | null;
  position: string | null;
  unit: string | null;
};

export type EquipmentRecord = {
  id: string;
  category: EquipmentCategory;
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
  createdAt: number;
  updatedAt: number;
};

export type StorageDeviceRecord = {
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

export type EquipmentTransferRecord = {
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
  transferredAt: number;
  createdByName: string | null;
};

export type EquipmentDetail = EquipmentRecord & {
  storageDevices: StorageDeviceRecord[];
  transfers: EquipmentTransferRecord[];
};

export type EquipmentStats = {
  total: number;
  inUse: number;
  storage: number;
  repair: number;
  broken: number;
};

export type EquipmentListResult = {
  items: EquipmentRecord[];
  total: number;
  page: number;
  pageCount: number;
  stats: EquipmentStats;
  locations: string[];
};

export const optionalEmpty = z
  .string()
  .trim()
  .max(256)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

export const EquipmentFormSchema = z.object({
  deviceType: z.enum(["pevm", "arm", "laptop", "server", "other"]),
  displayName: z.string().trim().min(1, "Обязательное поле").max(256),
  inventoryNumber: optionalEmpty,
  serialNumber: optionalEmpty,
  mniSerialNumber: optionalEmpty,
  manufacturer: optionalEmpty,
  model: optionalEmpty,
  cpu: optionalEmpty,
  ramGb: z.number().int().positive().optional().nullable(),
  storageType: z.enum(["HDD", "SSD", "NVMe", "eMMC"]).optional().nullable(),
  storageGb: z.number().int().positive().optional().nullable(),
  os: optionalEmpty,
  status: z.enum(["in_use", "storage", "repair", "broken"]),
  isWorking: z.boolean(),
  location: optionalEmpty,
  personId: z
    .union([z.string().trim().min(1).max(120), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value && value !== "" ? value : null)),
  hasCharger: z.boolean().optional().nullable(),
  isChargerWorking: z.boolean().optional().nullable(),
  hasMouse: z.boolean().optional().nullable(),
  isMouseWorking: z.boolean().optional().nullable(),
  hasBag: z.boolean().optional().nullable(),
});

export type EquipmentFormValues = z.infer<typeof EquipmentFormSchema>;

export const BatchIssueSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(120)).min(1).max(500),
  toPersonId: z.string().trim().min(1).max(120).optional().nullable(),
  toLocation: optionalEmpty,
  documentRef: optionalEmpty,
  notes: z.string().trim().max(512).optional(),
});

export const BatchMoveSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(120)).min(1).max(500),
  toLocation: z.string().trim().min(1, "Укажите местоположение").max(256),
  notes: z.string().trim().max(512).optional(),
});

export const BatchReturnSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(120)).min(1).max(500),
  documentRef: optionalEmpty,
  notes: z.string().trim().max(512).optional(),
});

export function deviceTypeToCategory(deviceType: DeviceTypeValue): EquipmentCategory {
  return DEVICE_TYPES.find((item) => item.value === deviceType)?.category ?? "other";
}

export function statusLabel(status: EquipmentStatus) {
  return EQUIPMENT_STATUSES.find((item) => item.value === status)?.label ?? status;
}

export function deviceTypeLabel(deviceType: string) {
  return DEVICE_TYPES.find((item) => item.value === deviceType)?.label ?? deviceType;
}

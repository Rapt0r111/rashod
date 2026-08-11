import { z } from "zod";

export const STORAGE_ITEM_TYPES = [
  { value: "flash_drive", label: "Флеш-накопитель" },
  { value: "electronic_pass", label: "Электронный пропуск" },
] as const;

export type StorageItemType = (typeof STORAGE_ITEM_TYPES)[number]["value"];

export const STORAGE_ITEM_STATUSES = [
  { value: "stock", label: "На складе", tone: "blue" },
  { value: "in_use", label: "Выдан", tone: "green" },
  { value: "broken", label: "Неисправен", tone: "amber" },
  { value: "lost", label: "Утрачен", tone: "red" },
] as const;

export type StorageItemStatus = (typeof STORAGE_ITEM_STATUSES)[number]["value"];

export const STORAGE_ITEMS_PAGE_SIZE = 25;

export type StorageItemRecord = {
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
  issuedAt: number | null;
  returnedAt: number | null;
  notes: string;
  createdAt: number;
  updatedAt: number;
};

export type StorageItemStats = {
  total: number;
  stock: number;
  inUse: number;
  broken: number;
  lost: number;
};

export type StorageItemListResult = {
  items: StorageItemRecord[];
  total: number;
  page: number;
  pageCount: number;
  stats: StorageItemStats;
};

export const StorageItemFormSchema = z.object({
  type: z.enum(["flash_drive", "electronic_pass"]),
  inventoryNumber: z.string().trim().max(64).optional(),
  serialNumber: z.string().trim().max(128).optional(),
  capacityGb: z.number().int().positive().optional().nullable(),
  accessLevel: z.number().int().min(0).max(99).optional().nullable(),
  status: z.enum(["in_use", "stock", "broken", "lost"]),
  personId: z
    .union([z.string().trim().min(1).max(120), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value && value !== "" ? value : null)),
  notes: z.string().trim().max(2000).optional(),
});

export type StorageItemFormValues = z.infer<typeof StorageItemFormSchema>;

export const StorageItemBatchIssueSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(120)).min(1).max(500),
  toPersonId: z.string().trim().min(1).max(120),
});

export const StorageItemBatchReturnSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(120)).min(1).max(500),
});

export function storageItemTypeLabel(type: StorageItemType) {
  return STORAGE_ITEM_TYPES.find((item) => item.value === type)?.label ?? type;
}

export function storageItemStatusLabel(status: StorageItemStatus) {
  return STORAGE_ITEM_STATUSES.find((item) => item.value === status)?.label ?? status;
}

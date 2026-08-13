import { z } from "zod";

export const PHONE_STATUSES = [
  { value: "checked_out", label: "На руках", tone: "amber" },
  { value: "checked_in", label: "Сдан", tone: "green" },
] as const;

export type PhoneStatus = (typeof PHONE_STATUSES)[number]["value"];

export const PHONES_PAGE_SIZE = 25;

export type PhoneRecord = {
  id: string;
  personId: string | null;
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
  checkedInAt: number | null;
  checkedOutAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type PhoneStats = {
  total: number;
  checkedIn: number;
  checkedOut: number;
};

export type PhoneListResult = {
  items: PhoneRecord[];
  total: number;
  page: number;
  pageCount: number;
  stats: PhoneStats;
};

export const PhoneFormSchema = z.object({
  personId: z.string().trim().min(1, "Укажите владельца").max(120),
  brand: z.string().trim().max(64).optional(),
  model: z.string().trim().min(1, "Укажите модель").max(128),
  color: z.string().trim().max(32).optional(),
  imei1: z.string().trim().max(18).optional(),
  imei2: z.string().trim().max(18).optional(),
  serialNumber: z.string().trim().max(64).optional(),
  hasCamera: z.boolean(),
  hasVoiceRecorder: z.boolean(),
  status: z.enum(["checked_in", "checked_out"]),
  storageCell: z.string().trim().max(32).optional(),
});

export type PhoneFormValues = z.infer<typeof PhoneFormSchema>;

export const PhoneBatchSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(120)).min(1).max(500),
  storageCell: z.string().trim().max(32).optional(),
});

export function phoneStatusLabel(status: PhoneStatus) {
  return PHONE_STATUSES.find((item) => item.value === status)?.label ?? status;
}

import { describe, expect, it } from "vitest";
import { PhoneFormSchema, PhoneBatchSchema } from "@/features/zgt/phones-types";
import {
  StorageItemFormSchema,
  StorageItemBatchIssueSchema,
} from "@/features/zgt/storage-items-types";
import { POSTGRES_MIGRATIONS } from "@/server/db/migrate-postgres";

describe("zgt phones and storage items", () => {
  it("includes migration 0012 in the chain", () => {
    expect(POSTGRES_MIGRATIONS).toContain("0012_zgt_phones_and_storage_items.sql");
    expect(POSTGRES_MIGRATIONS.at(-1)).toBe("0012_zgt_phones_and_storage_items.sql");
  });

  it("validates phone form with people owner", () => {
    const parsed = PhoneFormSchema.safeParse({
      personId: "person-vz1-01",
      model: "iPhone 13",
      brand: "Apple",
      hasCamera: true,
      hasVoiceRecorder: false,
      status: "checked_out",
    });
    expect(parsed.success).toBe(true);
  });

  it("validates phone batch check-in payload", () => {
    expect(
      PhoneBatchSchema.safeParse({ ids: ["p1", "p2"], storageCell: "A-12" }).success,
    ).toBe(true);
  });

  it("normalizes empty person on storage item to null", () => {
    const parsed = StorageItemFormSchema.safeParse({
      type: "flash_drive",
      status: "stock",
      personId: "",
      inventoryNumber: "Ф-1",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.personId).toBeNull();
  });

  it("validates storage batch issue", () => {
    expect(
      StorageItemBatchIssueSchema.safeParse({
        ids: ["s1"],
        toPersonId: "person-1",
      }).success,
    ).toBe(true);
  });
});

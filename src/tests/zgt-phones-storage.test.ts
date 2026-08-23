import { describe, expect, it } from "vitest";
import { PhoneFormSchema, PhoneBatchSchema } from "@/features/zgt/phones-types";
import {
  StorageItemFormSchema,
  StorageItemBatchIssueSchema,
} from "@/features/zgt/storage-items-types";
import { POSTGRES_MIGRATIONS } from "@/server/db/migrate-postgres";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("zgt phones and storage items", () => {
  it("includes migration 0012 in the chain", () => {
    expect(POSTGRES_MIGRATIONS).toContain("0012_zgt_phones_and_storage_items.sql");
    expect(POSTGRES_MIGRATIONS).toContain("0013_phones_person_set_null.sql");
    expect(POSTGRES_MIGRATIONS).toContain("0014_location_foreign_keys.sql");
    expect(POSTGRES_MIGRATIONS).toContain("0015_people_location_no_catalog_fk.sql");
    expect(POSTGRES_MIGRATIONS.at(-1)).toBe("0015_people_location_no_catalog_fk.sql");
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

  it("publishes zgt mutations and subscribes live lists to the zgt domain", () => {
    const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
    for (const path of [
      "src/app/api/zgt/equipment/route.ts",
      "src/app/api/zgt/phones/route.ts",
      "src/app/api/zgt/storage-items/route.ts",
      "src/app/api/zgt/profiles/route.ts",
    ]) {
      expect(read(path)).toContain('publishRosterChanged("zgt")');
    }
    expect(read("src/app/api/events/route.ts")).toContain('"zgt:read"');
    expect(read("src/features/zgt/EquipmentApp.tsx")).toContain('useRealtimeDomain(["zgt", "unknown"]');
    expect(read("src/features/zgt/PhonesApp.tsx")).toContain('useRealtimeDomain(["zgt", "unknown"]');
    expect(read("src/features/zgt/StorageItemsApp.tsx")).toContain('useRealtimeDomain(["zgt", "unknown"]');
    expect(read("src/features/portal/PortalChrome.tsx")).toContain("RealtimeProvider");
    expect(read("src/features/zgt/ui.tsx")).toContain("SelectField");
    expect(read("src/features/zgt/ui.tsx")).not.toContain("<select");
    expect(read("src/features/zgt/ui.tsx")).toContain("ZgtConfirmDialog");
    expect(read("src/features/zgt/ui.tsx")).toContain("ZgtToggleChip");
    expect(read("src/features/zgt/ui.tsx")).toContain("ZgtListLayout");
    expect(read("src/features/portal/ZgtStub.tsx")).toContain("Как работать");
    expect(read("src/features/portal/ZgtStub.tsx")).toContain("/zgt/phones?status=checked_out");
    for (const path of [
      "src/features/zgt/EquipmentApp.tsx",
      "src/features/zgt/PhonesApp.tsx",
      "src/features/zgt/StorageItemsApp.tsx",
    ]) {
      const source = read(path);
      expect(source).not.toContain("confirm(");
      expect(source).not.toContain('type="checkbox"');
      expect(source).toContain("ZgtConfirmDialog");
      expect(source).toContain("ZgtListLayout");
      expect(source).toContain("formError");
    }
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

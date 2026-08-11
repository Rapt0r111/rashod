import { describe, expect, it } from "vitest";
import {
  BatchIssueSchema,
  EquipmentFormSchema,
  deviceTypeToCategory,
  DEVICE_TYPES,
} from "@/features/zgt/types";
import { PERMISSIONS } from "@/features/auth/permissions";

describe("zgt equipment domain", () => {
  it("maps device types to categories", () => {
    expect(deviceTypeToCategory("pevm")).toBe("workstation");
    expect(deviceTypeToCategory("arm")).toBe("workstation");
    expect(deviceTypeToCategory("laptop")).toBe("laptop");
    expect(deviceTypeToCategory("server")).toBe("server");
    expect(DEVICE_TYPES).toHaveLength(5);
  });

  it("accepts equipment form payload with person from people registry", () => {
    const parsed = EquipmentFormSchema.safeParse({
      deviceType: "laptop",
      displayName: "НС-1",
      status: "in_use",
      isWorking: true,
      personId: "person-vz1-01",
      inventoryNumber: "МО-001",
      location: "Каб. 12",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.personId).toBe("person-vz1-01");
      expect(parsed.data.inventoryNumber).toBe("МО-001");
    }
  });

  it("normalizes empty person id to null", () => {
    const parsed = EquipmentFormSchema.safeParse({
      deviceType: "other",
      displayName: "ТВ",
      status: "storage",
      isWorking: true,
      personId: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.personId).toBeNull();
  });

  it("validates batch issue payload", () => {
    const parsed = BatchIssueSchema.safeParse({
      ids: ["eq-1", "eq-2"],
      toPersonId: "person-1",
      toLocation: "Склад",
    });
    expect(parsed.success).toBe(true);
  });

  it("keeps zgt permissions in RBAC catalog", () => {
    expect(PERMISSIONS).toEqual(
      expect.arrayContaining(["zgt:read", "zgt:write"]),
    );
  });
});

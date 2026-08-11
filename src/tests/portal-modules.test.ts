import { describe, expect, it } from "vitest";
import {
  hasAnyPortalModule,
  hasRashodAccess,
  hasZgtAccess,
  modulesForPermissions,
} from "@/features/portal/modules";
import { PERMISSIONS } from "@/features/auth/permissions";

describe("portal modules", () => {
  it("exposes zgt permissions in the shared RBAC catalog", () => {
    expect(PERMISSIONS).toContain("zgt:read");
    expect(PERMISSIONS).toContain("zgt:write");
  });

  it("marks modules available only for granted permissions", () => {
    const modules = modulesForPermissions(["roster:read"]);
    expect(modules.find((module) => module.id === "rashod")?.available).toBe(true);
    expect(modules.find((module) => module.id === "zgt")?.available).toBe(false);
  });

  it("treats zgt:write as sufficient for ZГТ module access", () => {
    expect(hasZgtAccess(["zgt:write"])).toBe(true);
    expect(hasAnyPortalModule(["zgt:write"])).toBe(true);
    expect(hasRashodAccess(["zgt:write"])).toBe(false);
  });
});

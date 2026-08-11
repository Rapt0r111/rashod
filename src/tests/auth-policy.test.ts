import { describe, expect, it } from "vitest";
import {
  canGrantRole,
  canManageTargetAccount,
  isAdministrator,
  type GrantActor,
  type GrantRole,
} from "@/server/auth/policy";
import { hasPermission } from "@/features/auth/permissions";

const administrator: GrantRole = {
  id: "role-administrator",
  isSystem: true,
  permissions: ["users:manage", "roles:manage", "access:grant"],
};
const rosterWriter: GrantRole = {
  id: "role-roster-writer",
  isSystem: false,
  permissions: ["roster:read", "roster:write"],
};

const accessManager: GrantActor = {
  id: "manager",
  roleIds: ["role-access-manager"],
  permissions: ["users:manage", "roles:manage", "access:grant", "roster:read"],
};

describe("RBAC delegation policy", () => {
  it("never lets a non-administrator grant the system administrator role", () => {
    expect(canGrantRole(accessManager, administrator)).toBe(false);
  });

  it("allows delegated roles only when every granted permission is already held", () => {
    expect(canGrantRole(accessManager, rosterWriter)).toBe(false);
    expect(canGrantRole({ ...accessManager, permissions: [...accessManager.permissions, "roster:write"] }, rosterWriter)).toBe(true);
  });

  it("prevents self and higher-privilege account takeover", () => {
    expect(canManageTargetAccount(accessManager, accessManager.id, [rosterWriter], true)).toBe(false);
    expect(canManageTargetAccount(accessManager, "admin", [administrator], true)).toBe(false);
  });

  it("recognizes only the protected administrator role as super-admin", () => {
    expect(isAdministrator(accessManager)).toBe(false);
    expect(isAdministrator({ ...accessManager, roleIds: ["role-administrator"] })).toBe(true);
  });

  it("makes snapshot-returning write permissions explicitly imply read", () => {
    expect(hasPermission({ permissions: ["roster:write"] }, "roster:read")).toBe(true);
    expect(hasPermission({ permissions: ["groups:write"] }, "groups:read")).toBe(true);
    expect(hasPermission({ permissions: ["zgt:write"] }, "zgt:read")).toBe(true);
  });
});

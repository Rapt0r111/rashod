import { describe, expect, it } from "vitest";
import {
  assertCanSaveRole,
  canGrantRole,
  canManageTargetAccount,
  isAdministrator,
  isNearAdminRole,
  type GrantActor,
  type GrantRole,
} from "@/server/auth/policy";
import { hasPermission, PERMISSIONS } from "@/features/auth/permissions";

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
const customNearAdmin: GrantRole = {
  id: "role-custom-near-admin",
  isSystem: false,
  permissions: ["users:manage", "roles:manage", "access:grant", "roster:read"],
};
const fullClone: GrantRole = {
  id: "role-full-clone",
  isSystem: false,
  permissions: [...PERMISSIONS],
};

const accessManager: GrantActor = {
  id: "manager",
  roleIds: ["role-access-manager"],
  permissions: ["users:manage", "roles:manage", "access:grant", "roster:read"],
};
const systemAdmin: GrantActor = {
  id: "admin",
  roleIds: ["role-administrator"],
  permissions: [...PERMISSIONS],
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
    expect(canManageTargetAccount(accessManager, "near-admin", [customNearAdmin], true)).toBe(false);
    expect(canManageTargetAccount(systemAdmin, "near-admin", [customNearAdmin], true)).toBe(true);
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

  it("treats custom privilege-cluster and full-clone roles as near-admin", () => {
    expect(isNearAdminRole(administrator)).toBe(true);
    expect(isNearAdminRole(customNearAdmin)).toBe(true);
    expect(isNearAdminRole(fullClone)).toBe(true);
    expect(isNearAdminRole(rosterWriter)).toBe(false);
    expect(
      isNearAdminRole({
        id: "role-partial",
        isSystem: false,
        permissions: ["users:manage", "roles:manage"],
      }),
    ).toBe(false);
  });

  it("lets only the system administrator grant custom near-admin roles", () => {
    expect(canGrantRole(accessManager, customNearAdmin)).toBe(false);
    expect(canGrantRole(accessManager, fullClone)).toBe(false);
    expect(canGrantRole(systemAdmin, customNearAdmin)).toBe(true);
    expect(canGrantRole(systemAdmin, fullClone)).toBe(true);
  });
});

describe("assertCanSaveRole", () => {
  it("requires access:grant before any role save", () => {
    expect(() =>
      assertCanSaveRole(
        { id: "ops", roleIds: [], permissions: ["roles:manage"] },
        { id: "role-new", permissions: ["roster:read"] },
      ),
    ).toThrow("ACCESS_GRANT_REQUIRED");
  });

  it("rejects an empty permission set", () => {
    expect(() =>
      assertCanSaveRole(systemAdmin, {
        id: "role-new",
        permissions: [],
      }),
    ).toThrow("ROLE_PERMISSIONS_REQUIRED");
  });

  it("rejects updates unless the existing role is already grantable", () => {
    expect(() =>
      assertCanSaveRole(accessManager, {
        id: customNearAdmin.id,
        existing: customNearAdmin,
        permissions: ["roster:read"],
      }),
    ).toThrow("ROLE_GRANT_FORBIDDEN");
    expect(() =>
      assertCanSaveRole(accessManager, {
        id: rosterWriter.id,
        existing: rosterWriter,
        permissions: ["roster:read"],
      }),
    ).toThrow("ROLE_GRANT_FORBIDDEN");
  });

  it("rejects creating or widening into a near-admin role without the system administrator", () => {
    expect(() =>
      assertCanSaveRole(accessManager, {
        id: "role-new",
        permissions: customNearAdmin.permissions,
      }),
    ).toThrow("ROLE_GRANT_FORBIDDEN");
  });

  it("protects the system administrator role from any save", () => {
    expect(() =>
      assertCanSaveRole(systemAdmin, {
        id: "role-administrator",
        existing: administrator,
        permissions: ["roster:read"],
      }),
    ).toThrow("SYSTEM_ROLE_PROTECTED");
  });

  it("allows a delegated manager to save a role they could already grant", () => {
    expect(() =>
      assertCanSaveRole(accessManager, {
        id: "role-new",
        permissions: ["roster:read"],
      }),
    ).not.toThrow();
    expect(() =>
      assertCanSaveRole(systemAdmin, {
        id: customNearAdmin.id,
        existing: customNearAdmin,
        permissions: ["roster:read", "roster:write"],
      }),
    ).not.toThrow();
  });
});

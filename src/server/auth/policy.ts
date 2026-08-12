export type GrantActor = {
  id: string;
  roleIds: readonly string[];
  permissions: readonly string[];
};

export type GrantRole = {
  id: string;
  isSystem: boolean;
  permissions: readonly string[];
};

const ADMIN_ROLE_ID = "role-administrator";

/** Privilege-control cluster: a custom role with all three is a near-admin. */
const NEAR_ADMIN_PERMISSIONS = [
  "users:manage",
  "roles:manage",
  "access:grant",
] as const;

export function isAdministrator(actor: GrantActor) {
  return actor.roleIds.includes(ADMIN_ROLE_ID);
}

/** System role or custom role that can administer accounts and grants. */
export function isNearAdminRole(role: GrantRole) {
  if (role.isSystem) return true;
  return NEAR_ADMIN_PERMISSIONS.every((permission) =>
    role.permissions.includes(permission),
  );
}

/** Delegated administrators may grant only capabilities they already possess. */
export function canGrantRole(actor: GrantActor, role: GrantRole) {
  if (!actor.permissions.includes("access:grant")) return false;
  if (role.isSystem) return isAdministrator(actor) && role.id === ADMIN_ROLE_ID;
  if (isNearAdminRole(role)) return isAdministrator(actor);
  return role.permissions.every((permission) =>
    actor.permissions.includes(permission),
  );
}

/** Account takeover is prevented for the caller and any account above its scope. */
export function canManageTargetAccount(
  actor: GrantActor,
  targetUserId: string,
  targetRoles: readonly GrantRole[],
  securitySensitiveChange: boolean,
) {
  if (!securitySensitiveChange) return true;
  if (actor.id === targetUserId) return false;
  return targetRoles.every((role) => canGrantRole(actor, role));
}

/** Create/update checks: existing role must already be grantable; no empty set. */
export function assertCanSaveRole(
  actor: GrantActor,
  input: {
    id: string;
    existing?: GrantRole;
    permissions: readonly string[];
  },
) {
  if (!actor.permissions.includes("access:grant"))
    throw new Error("ACCESS_GRANT_REQUIRED");
  if (!input.permissions.length) throw new Error("ROLE_PERMISSIONS_REQUIRED");
  if (input.existing?.isSystem || input.id === ADMIN_ROLE_ID)
    throw new Error("SYSTEM_ROLE_PROTECTED");
  if (input.existing && !canGrantRole(actor, input.existing))
    throw new Error("ROLE_GRANT_FORBIDDEN");
  if (
    !canGrantRole(actor, {
      id: input.id,
      isSystem: false,
      permissions: input.permissions,
    })
  )
    throw new Error("ROLE_GRANT_FORBIDDEN");
}

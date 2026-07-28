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

export function isAdministrator(actor: GrantActor) {
  return actor.roleIds.includes(ADMIN_ROLE_ID);
}

/** Delegated administrators may grant only capabilities they already possess. */
export function canGrantRole(actor: GrantActor, role: GrantRole) {
  if (!actor.permissions.includes("access:grant")) return false;
  if (role.isSystem) return isAdministrator(actor) && role.id === ADMIN_ROLE_ID;
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

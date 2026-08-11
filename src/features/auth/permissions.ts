export const PERMISSIONS = [
  "roster:read",
  "roster:write",
  "references:manage",
  "groups:read",
  "groups:write",
  "tasks:read",
  "tasks:write",
  "zgt:read",
  "zgt:write",
  "users:manage",
  "roles:manage",
  "access:grant",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const impliedPermissions: Partial<Record<Permission, Permission[]>> = {
  "roster:read": ["roster:write", "references:manage"],
  "groups:read": ["groups:write"],
  "tasks:read": ["tasks:write"],
  "zgt:read": ["zgt:write"],
};

export function hasPermission(context: { permissions: readonly Permission[] }, permission: Permission) {
  return context.permissions.includes(permission) || (impliedPermissions[permission] ?? []).some((implied) => context.permissions.includes(implied));
}

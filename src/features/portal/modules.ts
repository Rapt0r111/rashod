import type { Permission } from "@/features/auth/permissions";
import { hasPermission } from "@/features/auth/permissions";

export type PortalModuleId = "rashod" | "zgt";

export type PortalModule = {
  id: PortalModuleId;
  href: string;
  title: string;
  shortTitle: string;
  description: string;
  badge: string;
  requiredPermission: Permission;
};

export const PORTAL_MODULES: readonly PortalModule[] = [
  {
    id: "rashod",
    href: "/",
    title: "Расход личного состава",
    shortTitle: "Расход",
    description:
      "Местоположения, взводы, группы, график и задачи. Основной инструмент дежурного.",
    badge: "ЛС",
    requiredPermission: "roster:read",
  },
  {
    id: "zgt",
    href: "/zgt",
    title: "ЗГТ — учёт техники",
    shortTitle: "ЗГТ",
    description:
      "Вычислительная техника, выдачи и сдача, история. Владелец — из реестра Расхода.",
    badge: "ЗГТ",
    requiredPermission: "zgt:read",
  },
] as const;

export function modulesForPermissions(
  permissions: readonly Permission[],
): Array<PortalModule & { available: boolean }> {
  const context = { permissions };
  return PORTAL_MODULES.map((module) => ({
    ...module,
    available: hasPermission(context, module.requiredPermission),
  }));
}

export function hasAnyPortalModule(permissions: readonly Permission[]) {
  return modulesForPermissions(permissions).some((module) => module.available);
}

export function hasRashodAccess(permissions: readonly Permission[]) {
  const context = { permissions };
  return (
    hasPermission(context, "roster:read") ||
    hasPermission(context, "groups:read") ||
    hasPermission(context, "tasks:read")
  );
}

export function hasZgtAccess(permissions: readonly Permission[]) {
  return hasPermission({ permissions }, "zgt:read");
}

"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { PortalChrome } from "./PortalChrome";
import {
  modulesForPermissions,
  type PortalModuleId,
} from "./modules";
import type { Permission } from "@/features/auth/permissions";
import { cx } from "@/features/roster/utils";

export function PortalHome({
  displayName,
  permissions,
}: {
  displayName: string;
  permissions: readonly Permission[];
}) {
  const modules = modulesForPermissions(permissions);
  const availableModuleIds = modules
    .filter((module) => module.available)
    .map((module) => module.id) as PortalModuleId[];

  return (
    <PortalChrome
      activeModule="portal"
      displayName={displayName}
      availableModuleIds={availableModuleIds}
      title="Выберите рабочий модуль"
      subtitle="Один вход для оперативных задач роты. Расход и ЗГТ остаются разными инструментами, но без повторного логина."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {modules.map((module) => {
          const cardClass = cx(
            "group relative flex min-h-44 flex-col rounded-[22px] border p-5 transition-[border-color,background-color] duration-150",
            module.available
              ? "border-line bg-bg-panel/80 hover:border-line-strong hover:bg-bg-raised/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
              : "border-line/60 bg-bg-panel/40 opacity-70",
          );

          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div
                  className={cx(
                    "grid h-11 w-11 place-items-center rounded-2xl text-sm font-black",
                    module.id === "zgt"
                      ? "bg-[color-mix(in_oklch,var(--amber)_18%,transparent)] text-amber"
                      : "bg-[color-mix(in_oklch,var(--cyan)_16%,transparent)] text-cyan",
                  )}
                >
                  {module.badge}
                </div>
                {module.available ? (
                  <ArrowRightIcon
                    className="text-text-muted transition group-hover:translate-x-0.5 group-hover:text-text-primary"
                    size={20}
                  />
                ) : (
                  <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-bold text-text-muted">
                    Нет доступа
                  </span>
                )}
              </div>
              <div className="mt-auto pt-6">
                <h2 className="m-0 text-xl font-bold tracking-[-0.02em]">
                  {module.title}
                </h2>
                <p className="m-0 mt-2 text-sm leading-6 text-text-secondary">
                  {module.description}
                </p>
              </div>
            </>
          );

          if (!module.available) {
            return (
              <div key={module.id} className={cardClass} aria-disabled="true">
                {body}
              </div>
            );
          }

          return (
            <Link
              key={module.id}
              href={module.href}
              className={cx(cardClass, "no-underline text-inherit")}
            >
              {body}
            </Link>
          );
        })}
      </div>
    </PortalChrome>
  );
}

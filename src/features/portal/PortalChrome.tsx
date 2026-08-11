"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SignOutIcon } from "@phosphor-icons/react";
import type { PortalModuleId } from "./modules";
import { PORTAL_MODULES } from "./modules";
import { cx } from "@/features/roster/utils";

export function PortalChrome({
  activeModule,
  displayName,
  availableModuleIds,
  title,
  subtitle,
  children,
}: {
  activeModule?: PortalModuleId | "portal";
  displayName: string;
  availableModuleIds: readonly PortalModuleId[];
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const modules = PORTAL_MODULES.filter((module) =>
    availableModuleIds.includes(module.id),
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  // Body scroll is locked app-wide (html/body overflow:hidden + height:100%).
  // Portal shell needs a fixed viewport height (h-dvh) so main can scroll;
  // min-h-dvh alone expands with content and never creates a scrollport.
  return (
    <div className="relative z-1 isolate flex h-dvh min-h-0 flex-col overflow-hidden bg-bg-base bg-[radial-gradient(circle_at_18%_-8%,oklch(32%_0.12_302/0.28),transparent_36%),radial-gradient(circle_at_88%_12%,oklch(34%_0.11_193/0.16),transparent_30%)] text-text-primary">
      <header className="shrink-0 border-b border-line bg-[color-mix(in_oklch,var(--bg-base)_94%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center gap-3 px-4 py-2.5 max-[560px]:px-3">
          <Link
            href="/portal"
            className="flex min-w-0 items-center gap-3 no-underline text-inherit"
            aria-label="Портал роты"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-[linear-gradient(135deg,var(--accent),var(--cyan))] font-extrabold text-[oklch(12%_0.04_286)]">
              Р
            </div>
            <div className="min-w-0 max-[420px]:hidden">
              <div className="overflow-hidden text-ellipsis whitespace-nowrap font-bold">
                Портал роты
              </div>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
                Расход и ЗГТ
              </div>
            </div>
          </Link>

          {modules.length > 0 && (
            <nav
              className="ml-2 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
              aria-label="Модули"
            >
              <Link
                href="/portal"
                className={cx(
                  "inline-flex min-h-[42px] shrink-0 items-center rounded-[13px] border px-3 text-xs font-semibold no-underline transition-[background-color,border-color,color] duration-150",
                  activeModule === "portal"
                    ? "border-accent-line bg-accent-soft text-text-primary"
                    : "border-line bg-white/4 text-text-secondary hover:border-line-strong hover:text-text-primary",
                )}
              >
                Модули
              </Link>
              {modules.map((module) => {
                const active = activeModule === module.id;
                return (
                  <Link
                    key={module.id}
                    href={module.href}
                    className={cx(
                      "inline-flex min-h-[42px] shrink-0 items-center rounded-[13px] border px-3 text-xs font-semibold no-underline transition-[background-color,border-color,color] duration-150",
                      active
                        ? "border-[color-mix(in_oklch,var(--cyan)_34%,transparent)] bg-[color-mix(in_oklch,var(--cyan)_14%,transparent)] text-cyan"
                        : "border-line bg-white/4 text-text-secondary hover:border-line-strong hover:text-text-primary",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {module.shortTitle}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="max-w-36 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-text-secondary max-[520px]:hidden">
              {displayName}
            </span>
            <button
              type="button"
              className="relative grid h-10 w-10 place-items-center rounded-xl border border-line text-text-secondary transition hover:border-line-strong hover:bg-white/7.5"
              onClick={() => void logout()}
              aria-label="Выйти"
            >
              <SignOutIcon size={20} weight="regular" />
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 max-[560px]:px-3 max-[560px]:py-6">
          <div className="mb-6 max-w-2xl">
            <h1 className="m-0 text-[28px] font-bold leading-[1.08] tracking-[-0.02em] max-[720px]:text-2xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="m-0 mt-2 max-w-[65ch] text-sm leading-6 text-text-secondary">
                {subtitle}
              </p>
            ) : null}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutIcon } from "@phosphor-icons/react";
import type { PortalModuleId } from "./modules";
import { PORTAL_MODULES } from "./modules";
import { cx } from "@/features/roster/utils";
import { RealtimeProvider } from "@/features/realtime/RealtimeProvider";

const PortalShellContext = createContext(false);

/** True when wrapped by the portal/ZGT layout shell. */
export function usePortalShell() {
  return useContext(PortalShellContext);
}

export function resolvePortalActiveModule(
  pathname: string,
): PortalModuleId | "portal" | undefined {
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return "portal";
  if (pathname === "/zgt" || pathname.startsWith("/zgt/")) return "zgt";
  if (pathname === "/" || pathname === "") return "rashod";
  return undefined;
}

/**
 * Persistent chrome for /portal and /zgt/* only.
 *
 * Structure is identical on server and client (no pathname branching for
 * chrome vs full-bleed) — active tab highlighting is the only client-side
 * path dependency and does not change the DOM tree shape.
 *
 * Nested shells never paint a second header.
 */
export function PortalShell({
  displayName,
  availableModuleIds,
  children,
}: {
  displayName: string;
  availableModuleIds: readonly PortalModuleId[];
  children: ReactNode;
}) {
  const nested = useContext(PortalShellContext);
  if (nested) return <>{children}</>;

  return (
    <PortalShellContext.Provider value={true}>
      <PortalShellFrame
        displayName={displayName}
        availableModuleIds={availableModuleIds}
      >
        <RealtimeProvider>{children}</RealtimeProvider>
      </PortalShellFrame>
    </PortalShellContext.Provider>
  );
}

function PortalShellFrame({
  displayName,
  availableModuleIds,
  children,
}: {
  displayName: string;
  availableModuleIds: readonly PortalModuleId[];
  children: ReactNode;
}) {
  const pathname = usePathname() || "/";
  const activeModule = resolvePortalActiveModule(pathname);
  const modules = PORTAL_MODULES.filter((module) =>
    availableModuleIds.includes(module.id),
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  return (
    <div
      data-portal-shell=""
      className="relative z-1 isolate flex h-dvh min-h-0 flex-col overflow-hidden bg-bg-base text-text-primary"
    >
      <header className="shrink-0 border-b border-line bg-bg-base">
        <div className="mx-auto flex min-h-16 w-full items-center gap-3 px-5 py-2.5 max-[560px]:px-3">
          <Link
            href="/portal"
            prefetch
            className="flex min-w-0 items-center gap-3 no-underline text-inherit"
            aria-label="Портал роты"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-accent font-extrabold text-[oklch(12%_0.04_286)]">
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
                prefetch
                className={cx(
                  "inline-flex min-h-[42px] shrink-0 items-center rounded-[10px] border px-3 text-xs font-semibold no-underline transition-[background-color,border-color,color] duration-150",
                  activeModule === "portal"
                    ? "border-accent-line bg-accent-soft text-text-primary"
                    : "border-transparent text-text-secondary hover:bg-bg-raised hover:text-text-primary",
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
                    prefetch
                    className={cx(
                      "inline-flex min-h-[42px] shrink-0 items-center rounded-[10px] border px-3 text-xs font-semibold no-underline transition-[background-color,border-color,color] duration-150",
                      active
                        ? "border-transparent bg-bg-raised text-cyan"
                        : "border-transparent text-text-secondary hover:bg-bg-raised hover:text-text-primary",
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

      <main className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        {children}
      </main>
    </div>
  );
}

/** Page title block inside the shared shell. */
export function PortalPageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
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
  );
}

/**
 * @deprecated Prefer layout-level PortalShell + PortalPageHeader.
 * Nested shells are ignored (render children only).
 */
export function PortalChrome({
  activeModule: _activeModule,
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
  return (
    <PortalShell displayName={displayName} availableModuleIds={availableModuleIds}>
      <PortalPageHeader title={title} subtitle={subtitle} />
      {children}
    </PortalShell>
  );
}

/** Skeleton shell while layout auth resolves — same tree shape as PortalShell. */
export function PortalShellFallback() {
  return (
    <div
      data-portal-shell=""
      className="relative z-1 isolate flex h-dvh min-h-0 flex-col overflow-hidden bg-bg-base text-text-primary"
      aria-busy="true"
      aria-label="Загрузка"
    >
      <header className="shrink-0 border-b border-line bg-[color-mix(in_oklch,var(--bg-base)_94%,transparent)]">
        <div className="mx-auto flex min-h-16 w-full items-center gap-3 px-5 py-2.5 max-[560px]:px-3">
          <div className="h-10 w-10 shrink-0 rounded-[13px] bg-white/8" />
          <div className="hidden h-4 w-28 rounded-md bg-white/6 min-[420px]:block" />
          <div className="ml-2 flex flex-1 gap-1.5">
            <div className="h-[42px] w-20 rounded-[13px] bg-white/5" />
            <div className="h-[42px] w-20 rounded-[13px] bg-white/5" />
          </div>
          <div className="ml-auto h-4 w-24 rounded-md bg-white/6 max-[520px]:hidden" />
        </div>
      </header>
      <main className="min-h-0 flex-1" />
    </div>
  );
}

/** Content placeholder under the portal header. */
export function PortalContentFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Загрузка раздела">
      <div className="h-8 w-2/5 max-w-xs rounded-lg bg-white/6" />
      <div className="h-4 w-3/5 max-w-md rounded-md bg-white/4" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="min-h-36 rounded-[22px] border border-line/60 bg-bg-panel/40" />
        <div className="min-h-36 rounded-[22px] border border-line/60 bg-bg-panel/40" />
      </div>
    </div>
  );
}

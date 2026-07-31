"use client";

import { useEffect, useState } from "react";
import {
  ClockCounterClockwiseIcon,
  DownloadSimpleIcon,
  ListIcon,
  SidebarSimpleIcon,
  ArrowsOutSimpleIcon,
  ArrowsInSimpleIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import { formatClock, formatDateLabel } from "../utils";

export function TopBar(props: {
  unseen: boolean;
  isFullscreen: boolean;
  onMenu: () => void;
  onHistory: () => void;
  onExport: () => void;
  onAdmin: () => void;
  canManageReferences: boolean;
  onLogout: () => void;
  onToggleFullscreen: () => void;
}) {
  return (
    <header className="flex h-16 min-w-0 items-center gap-3 border-b border-line bg-[oklch(15%_0.04_286)] px-4.5 max-[1180px]:gap-2.5 max-[1180px]:px-3.5 max-[900px]:h-16 max-[900px]:min-h-16 max-[900px]:gap-2.5 max-[900px]:px-3.5 max-[560px]:gap-2 max-[560px]:px-2.5">
      <div
        className="flex min-w-47 w-58 flex-[0_1_232px] items-center gap-3 max-[1180px]:min-w-46 max-[1180px]:basis-52 max-[900px]:min-w-29.5 max-[900px]:basis-37.5 max-[560px]:min-w-11 max-[560px]:basis-11"
        aria-label="Расход личного состава"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-[linear-gradient(135deg,var(--accent),var(--cyan))] font-extrabold text-[oklch(12%_0.04_286)]">
          ЛС
        </div>
        <div className="min-w-0 max-[560px]:hidden">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap font-bold">
            Расход л/с
          </div>
          {/* Added suppressHydrationWarning here as well in case the date shifts */}
          <div
            className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted max-[900px]:hidden"
            suppressHydrationWarning
          >
            <LiveDate />
          </div>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 max-[560px]:gap-1.5">
        <button
          className="relative hidden h-10 w-10 place-items-center rounded-xl border border-line text-text-secondary transition hover:border-line-strong hover:bg-white/7.5 max-[900px]:inline-grid"
          type="button"
          onClick={props.onMenu}
          aria-label="Открыть меню разделов"
        >
          <ListIcon size={20} weight="bold" />
        </button>
        <button
          className="relative grid h-10 w-10 place-items-center rounded-xl border border-line text-text-secondary transition hover:border-line-strong hover:bg-white/7.5"
          type="button"
          onClick={props.onHistory}
          aria-label="Журнал перемещений"
        >
          <ClockCounterClockwiseIcon size={20} weight="regular" />
          {props.unseen && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent shadow-[0_0_0_3px_var(--accent-soft)]" />
          )}
        </button>
        <button
          className="relative grid h-10 w-10 place-items-center rounded-xl border border-line text-text-secondary transition hover:border-line-strong hover:bg-white/7.5 max-[900px]:hidden"
          type="button"
          onClick={props.onExport}
          aria-label="Экспорт CSV"
        >
          <DownloadSimpleIcon size={20} weight="regular" />
        </button>
        {props.canManageReferences && (
          <button
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-line text-text-secondary transition hover:border-line-strong hover:bg-white/7.5 max-[900px]:hidden"
            type="button"
            onClick={props.onAdmin}
            aria-label="Справочники"
          >
            <SidebarSimpleIcon size={20} weight="regular" />
          </button>
        )}
        <button
          className="relative grid h-10 w-10 place-items-center rounded-xl border border-line text-text-secondary transition hover:border-line-strong hover:bg-white/7.5"
          type="button"
          onClick={props.onToggleFullscreen}
          aria-label={
            props.isFullscreen
              ? "Выйти из полноэкранного режима"
              : "Открыть на весь экран"
          }
        >
          {props.isFullscreen ? (
            <ArrowsInSimpleIcon size={20} weight="regular" />
          ) : (
            <ArrowsOutSimpleIcon size={20} weight="regular" />
          )}
        </button>
        <button
          className="relative grid h-10 w-10 place-items-center rounded-xl border border-line text-text-secondary transition hover:border-line-strong hover:bg-white/7.5"
          type="button"
          onClick={props.onLogout}
          aria-label="Выйти"
        >
          <SignOutIcon size={20} weight="regular" />
        </button>
      </div>
      {/* Added suppressHydrationWarning to resolve the error */}
      <div
        className="min-w-18 shrink-0 text-right font-mono text-lg font-bold leading-none text-text-primary max-[1100px]:hidden"
        suppressHydrationWarning
      >
        <LiveTime />
      </div>
    </header>
  );
}

function LiveDate() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  return <>{formatDateLabel(now)}</>;
}

function LiveTime() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  return <>{formatClock(now)}</>;
}

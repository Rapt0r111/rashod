import { useEffect, useRef } from "react";
import {
  ClockCounterClockwiseIcon,
  DownloadSimpleIcon,
  SignOutIcon,
  SidebarSimpleIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { Person } from "../types";
import { SERVICE_SECTIONS } from "../constants";
import { cx } from "../utils";

export type SectionCounts = Partial<Record<string, number>>;

const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useDialogFocus(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = ref.current;
    window.setTimeout(() => {
      const first = panel?.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [open]);

  return ref;
}

function formatCompactCount(value: number) {
  return value > 999 ? "999+" : String(value);
}

function sectionItems(
  people: Person[],
  counts: SectionCounts,
  canReadGroups: boolean,
  canReadTasks: boolean,
) {
  return SERVICE_SECTIONS.filter(
    (section) =>
      (section.key !== "groups" || canReadGroups) &&
      (section.key !== "tasks" || canReadTasks),
  ).map((section) => ({
    ...section,
    count: section.key === "all" ? people.length : counts[section.key],
  }));
}

export function Sidebar({
  people,
  counts,
  active,
  onSelect,
  canReadGroups,
  canReadTasks,
}: {
  people: Person[];
  counts: SectionCounts;
  active: string;
  onSelect: (key: string) => void;
  canReadGroups: boolean;
  canReadTasks: boolean;
}) {
  const items = sectionItems(people, counts, canReadGroups, canReadTasks);
  return (
    <aside className="flex min-w-0 flex-col justify-between overflow-hidden border-r border-line bg-[color-mix(in_oklch,var(--bg-base)_88%,transparent)] p-4 max-[1180px]:px-2.5 max-[900px]:hidden">
      <nav className="grid min-w-0 gap-1.5 overflow-y-auto pr-0.5" aria-label="Разделы">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={cx("grid min-h-10.5 w-full min-w-0 grid-cols-[20px_minmax(0,1fr)_42px] items-center gap-2 overflow-hidden rounded-[13px] border border-transparent px-2 py-0 text-left text-text-secondary transition duration-200", active === item.key && "border-[color-mix(in_oklch,var(--cyan)_32%,transparent)] bg-[color-mix(in_oklch,var(--cyan)_12%,transparent)] text-cyan")}
            aria-current={active === item.key ? "page" : undefined}
            onClick={() => onSelect(item.key)}
            title={item.count === undefined ? item.label : `${item.label}: ${item.count}`}
          >
            <UsersThreeIcon
              className="block h-4.5 w-4.5"
              size={18}
              weight="regular"
              aria-hidden="true"
            />
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{item.label}</span>
            {item.count !== undefined && <b className="w-10.5 max-w-10.5 justify-self-end overflow-hidden rounded-full bg-white/6 px-1.5 py-0.5 text-center font-mono text-[11px] text-text-muted" title={`${item.count}`}>{formatCompactCount(item.count)}</b>}
          </button>
        ))}
      </nav>
      <p className="mt-3 mb-0 wrap-anywhere text-[11px] leading-[1.45] text-text-muted">
        Данные работают локально и синхронизируются между устройствами через
        этот сервер.
      </p>
    </aside>
  );
}

export function SectionDrawer({
  open,
  people,
  counts,
  active,
  onClose,
  onSelect,
  onHistory,
  onExport,
  onAdmin,
  canManageReferences,
  onLogout,
  canReadGroups,
  canReadTasks,
}: {
  open: boolean;
  people: Person[];
  counts: SectionCounts;
  active: string;
  onClose: () => void;
  onSelect: (key: string) => void;
  onHistory: () => void;
  onExport: () => void;
  onAdmin: () => void;
  canManageReferences: boolean;
  onLogout: () => void;
  canReadGroups: boolean;
  canReadTasks: boolean;
}) {
  const panelRef = useDialogFocus(open, onClose);
  if (!open) return null;
  const items = sectionItems(people, counts, canReadGroups, canReadTasks);
  return (
    <div className="fixed inset-0 z-60 grid items-stretch justify-items-start bg-bg-overlay backdrop-blur-[10px]" onMouseDown={onClose}>
      <aside
        ref={panelRef}
        className="grid h-dvh w-[min(360px,calc(100vw-24px))] grid-rows-[auto_auto_minmax(0,1fr)] border-r border-line-strong bg-[color-mix(in_oklch,var(--bg-base)_92%,transparent)] shadow-[30px_0_90px_rgb(0_0_0/0.42)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="section-drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 items-start justify-between gap-3.5 border-b border-line p-4">
          <div>
            <h2 className="m-0 text-xl leading-tight" id="section-drawer-title">Разделы</h2>
            <p className="mt-1.5 mb-0 text-[13px] leading-[1.35] text-text-muted">Выберите обзор, общий список или подразделение</p>
          </div>
          <button
            type="button"
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-line text-text-secondary transition hover:border-line-strong hover:bg-white/7.5"
            onClick={onClose}
            aria-label="Закрыть меню"
          >
            <XIcon size={18} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 border-b border-line p-3 max-[420px]:grid-cols-2" aria-label="Действия">
          <button className="inline-flex min-h-10.5 min-w-0 items-center justify-center gap-1.5 rounded-[13px] border border-line bg-white/4 px-2.5 text-xs font-bold text-text-secondary transition hover:border-line-strong hover:bg-white/7.5 hover:text-text-primary" type="button" onClick={onHistory}>
            <ClockCounterClockwiseIcon size={17} weight="regular" />
            Журнал
          </button>
          <button className="inline-flex min-h-10.5 min-w-0 items-center justify-center gap-1.5 rounded-[13px] border border-line bg-white/4 px-2.5 text-xs font-bold text-text-secondary transition hover:border-line-strong hover:bg-white/7.5 hover:text-text-primary" type="button" onClick={onExport}>
            <DownloadSimpleIcon size={17} weight="regular" />
            CSV
          </button>
          {canManageReferences && (
            <button className="inline-flex min-h-10.5 min-w-0 items-center justify-center gap-1.5 rounded-[13px] border border-line bg-white/4 px-2.5 text-xs font-bold text-text-secondary transition hover:border-line-strong hover:bg-white/7.5 hover:text-text-primary" type="button" onClick={onAdmin}>
              <SidebarSimpleIcon size={17} weight="regular" />
              Справочники
            </button>
          )}
          <button className="inline-flex min-h-10.5 min-w-0 items-center justify-center gap-1.5 rounded-[13px] border border-line bg-white/4 px-2.5 text-xs font-bold text-text-secondary transition hover:border-line-strong hover:bg-white/7.5 hover:text-text-primary" type="button" onClick={onLogout}>
            <SignOutIcon size={17} weight="regular" />
            Выйти
          </button>
        </div>
        <nav className="grid min-h-0 content-start gap-2 overflow-auto p-3" aria-label="Разделы">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              className={cx("grid min-h-12 w-full min-w-0 grid-cols-[22px_minmax(0,1fr)_46px] items-center gap-2.5 overflow-hidden rounded-[15px] border border-line bg-white/[0.035] px-3 text-left text-text-secondary transition active:translate-y-px", active === item.key && "border-[color-mix(in_oklch,var(--cyan)_34%,transparent)] bg-[color-mix(in_oklch,var(--cyan)_14%,transparent)] text-cyan")}
              aria-current={active === item.key ? "page" : undefined}
              onClick={() => onSelect(item.key)}
            >
              <UsersThreeIcon
                className="block h-4.5 w-4.5"
                size={18}
                weight="regular"
                aria-hidden="true"
              />
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{item.label}</span>
              {item.count !== undefined && <b className="min-w-8.5 justify-self-end rounded-full bg-white/6 px-2 py-1 text-center font-mono text-[11px] text-text-muted">{formatCompactCount(item.count)}</b>}
            </button>
          ))}
        </nav>
      </aside>
    </div>
  );
}

export function MobileSectionNav({
  people,
  counts,
  active,
  onSelect,
  canReadGroups,
  canReadTasks,
}: {
  people: Person[];
  counts: SectionCounts;
  active: string;
  onSelect: (key: string) => void;
  canReadGroups: boolean;
  canReadTasks: boolean;
}) {
  const items = sectionItems(people, counts, canReadGroups, canReadTasks);
  return (
    <nav className="sticky top-0 z-20 -mx-4 mb-3 hidden gap-2 overflow-x-auto overscroll-x-contain border-b border-line bg-[color-mix(in_oklch,var(--bg-base)_95%,transparent)] px-4 py-2.5 pb-3 max-[900px]:flex" aria-label="Разделы">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={cx("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-white/4.5 px-3 text-text-secondary transition duration-200 active:translate-y-px", active === item.key && "border-[color-mix(in_oklch,var(--cyan)_34%,transparent)] bg-[color-mix(in_oklch,var(--cyan)_14%,transparent)] text-cyan")}
          aria-current={active === item.key ? "page" : undefined}
          onClick={() => onSelect(item.key)}
        >
          <span className="max-w-42 overflow-hidden text-ellipsis whitespace-nowrap">{item.label}</span>
          {item.count !== undefined && <b className="min-w-6.5 rounded-full bg-white/6 px-1.5 py-0.5 text-center font-mono text-[11px] text-text-muted">{formatCompactCount(item.count)}</b>}
        </button>
      ))}
    </nav>
  );
}

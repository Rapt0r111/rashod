import Link from "next/link";
import {
  CalendarBlankIcon,
  ChartPieSliceIcon,
  CheckSquareIcon,
  ClockCounterClockwiseIcon,
  FlagBannerIcon,
  DesktopTowerIcon,
  DownloadSimpleIcon,
  SignOutIcon,
  SidebarSimpleIcon,
  SquaresFourIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useDialogFocus } from "@/components/use-dialog-focus";
import type { Person } from "../types";
import { SERVICE_SECTIONS } from "../constants";
import { cx } from "../utils";

export type SectionCounts = Partial<Record<string, number>>;

const sectionIcons = {
  overview: ChartPieSliceIcon,
  all: UsersThreeIcon,
  groups: FlagBannerIcon,
  schedule: CalendarBlankIcon,
  tasks: CheckSquareIcon,
} as const;

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
  canAccessZgt = false,
}: {
  people: Person[];
  counts: SectionCounts;
  active: string;
  onSelect: (key: string) => void;
  canReadGroups: boolean;
  canReadTasks: boolean;
  canAccessZgt?: boolean;
}) {
  const items = sectionItems(people, counts, canReadGroups, canReadTasks);
  return (
    <aside className="flex min-w-0 flex-col justify-between overflow-hidden border-r border-line bg-bg-base p-3 max-[1180px]:px-2.5 max-[900px]:hidden">
      <nav className="grid min-w-0 gap-1.5 overflow-y-auto pr-0.5" aria-label="Разделы">
        {items.map((item) => {
          const Icon = sectionIcons[item.key as keyof typeof sectionIcons] ?? UsersThreeIcon;
          return (
          <button
            key={item.key}
            type="button"
            className={cx("grid min-h-10.5 w-full min-w-0 grid-cols-[20px_minmax(0,1fr)_42px] items-center gap-2 overflow-hidden rounded-[10px] border border-transparent px-2 py-0 text-left text-text-secondary transition duration-200 hover:bg-bg-raised hover:text-text-primary", active === item.key && "bg-bg-raised text-cyan")}
            aria-current={active === item.key ? "page" : undefined}
            onClick={() => onSelect(item.key)}
            title={item.count === undefined ? item.label : `${item.label}: ${item.count}`}
          >
            <Icon
              className="block h-4.5 w-4.5"
              size={18}
              weight="regular"
              aria-hidden="true"
            />
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{item.label}</span>
            {item.count !== undefined && <b className="w-10.5 max-w-10.5 justify-self-end overflow-hidden rounded-full bg-white/6 px-1.5 py-0.5 text-center font-mono text-[11px] text-text-muted" title={`${item.count}`}>{formatCompactCount(item.count)}</b>}
          </button>
          );
        })}
      </nav>
      <div className="mt-3 grid min-w-0 gap-1.5 border-t border-line pt-3">
        {canAccessZgt ? (
          <Link
            href="/zgt"
            className="grid min-h-[42px] w-full min-w-0 grid-cols-[20px_minmax(0,1fr)] items-center gap-2 overflow-hidden rounded-[13px] border border-line bg-white/4 px-2 text-left text-sm font-semibold text-text-secondary no-underline transition hover:border-[color-mix(in_oklch,var(--cyan)_34%,transparent)] hover:bg-[color-mix(in_oklch,var(--cyan)_12%,transparent)] hover:text-cyan"
          >
            <DesktopTowerIcon size={18} weight="regular" aria-hidden />
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">ЗГТ</span>
          </Link>
        ) : null}
        <Link
          href="/portal"
          className="grid min-h-[42px] w-full min-w-0 grid-cols-[20px_minmax(0,1fr)] items-center gap-2 overflow-hidden rounded-[13px] border border-transparent px-2 text-left text-sm font-semibold text-text-muted no-underline transition hover:border-line hover:bg-white/4 hover:text-text-primary"
        >
          <SquaresFourIcon size={18} weight="regular" aria-hidden />
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Модули</span>
        </Link>
        <p className="mb-0 wrap-anywhere text-[11px] leading-[1.45] text-text-muted">
          Данные работают локально и синхронизируются между устройствами через
          этот сервер.
        </p>
      </div>
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
  canAccessZgt = false,
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
  canAccessZgt?: boolean;
  onLogout: () => void;
  canReadGroups: boolean;
  canReadTasks: boolean;
}) {
  const panelRef = useDialogFocus(onClose, { open, visibleOnly: true });
  if (!open) return null;
  const items = sectionItems(people, counts, canReadGroups, canReadTasks);
  return (
    <div className="fixed inset-0 z-60 grid items-stretch justify-items-start bg-bg-overlay backdrop-blur-[10px]" onMouseDown={onClose}>
      <aside
        ref={panelRef}
        className="grid h-dvh w-[min(360px,calc(100vw-24px))] grid-rows-[auto_auto_minmax(0,1fr)_auto] border-r border-line-strong bg-[color-mix(in_oklch,var(--bg-base)_92%,transparent)] shadow-[30px_0_90px_rgb(0_0_0/0.42)]"
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
              className={cx("grid min-h-12 w-full min-w-0 grid-cols-[22px_minmax(0,1fr)_46px] items-center gap-2.5 overflow-hidden rounded-[10px] border border-line bg-bg-panel px-3 text-left text-text-secondary transition active:translate-y-px", active === item.key && "border-transparent bg-bg-raised text-cyan")}
              aria-current={active === item.key ? "page" : undefined}
              onClick={() => onSelect(item.key)}
            >
              {(() => {
                const Icon = sectionIcons[item.key as keyof typeof sectionIcons] ?? UsersThreeIcon;
                return <Icon className="block h-4.5 w-4.5" size={18} weight="regular" aria-hidden="true" />;
              })()}
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{item.label}</span>
              {item.count !== undefined && <b className="min-w-8.5 justify-self-end rounded-full bg-white/6 px-2 py-1 text-center font-mono text-[11px] text-text-muted">{formatCompactCount(item.count)}</b>}
            </button>
          ))}
        </nav>
        <div className="grid gap-2 border-t border-line p-3" aria-label="Рабочие модули">
          {canAccessZgt ? (
            <Link
              href="/zgt"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[15px] border border-[color-mix(in_oklch,var(--cyan)_34%,transparent)] bg-[color-mix(in_oklch,var(--cyan)_12%,transparent)] px-3 text-sm font-semibold text-cyan no-underline"
              onClick={onClose}
            >
              <DesktopTowerIcon size={18} weight="regular" aria-hidden />
              Перейти в ЗГТ
            </Link>
          ) : null}
          <Link
            href="/portal"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[15px] border border-line bg-white/4 px-3 text-sm font-semibold text-text-secondary no-underline"
            onClick={onClose}
          >
            <SquaresFourIcon size={18} weight="regular" aria-hidden />
            Все модули
          </Link>
        </div>
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
    <nav className="top-0 z-20 -mx-4 mb-3 hidden gap-2 overflow-x-auto overscroll-x-contain border-b border-line bg-bg-base px-4 py-2.5 pb-3 max-[900px]:flex" aria-label="Разделы">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={cx("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[10px] border border-line bg-bg-panel px-3 text-text-secondary transition duration-200 active:translate-y-px", active === item.key && "border-transparent bg-bg-raised text-cyan")}
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

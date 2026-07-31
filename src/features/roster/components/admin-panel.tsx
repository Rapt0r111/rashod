import { useState } from "react";
import {
  ArrowLeftIcon,
  BuildingsIcon,
  CheckIcon,
  MapPinIcon,
  SlidersHorizontalIcon,
  StackSimpleIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useDialogFocus } from "@/components/use-dialog-focus";
import type { Snapshot } from "../types";
import { cx } from "../utils";
import { PeopleAdmin } from "./admin/people-admin";
import { PlatoonAdmin } from "./admin/platoon-admin";
import { LocationAdmin } from "./admin/location-admin";
import { LocationGroupAdmin } from "./admin/location-group-admin";
import { OverviewSettingsAdmin } from "./admin/overview-settings-admin";

export type AdminTab = "people" | "platoons" | "locations" | "location-groups" | "overview";

const referenceTabs: Array<{
  key: AdminTab;
  label: string;
  description: string;
}> = [
  { key: "people", label: "Люди", description: "Состав, звания и номера призыва" },
  { key: "platoons", label: "Подразделения", description: "Организационная структура" },
  { key: "locations", label: "Локации", description: "Места и быстрые коды" },
  { key: "location-groups", label: "Объединения мест", description: "Группировка для Обзора" },
  { key: "overview", label: "Настройка Обзора", description: "Состав и порядок блоков" },
];

function referenceTabIcon(tab: AdminTab) {
  if (tab === "people") return <UsersThreeIcon size={19} weight="regular" aria-hidden="true" />;
  if (tab === "platoons") return <BuildingsIcon size={19} weight="regular" aria-hidden="true" />;
  if (tab === "locations") return <MapPinIcon size={19} weight="regular" aria-hidden="true" />;
  if (tab === "location-groups") return <StackSimpleIcon size={19} weight="regular" aria-hidden="true" />;
  return <SlidersHorizontalIcon size={19} weight="regular" aria-hidden="true" />;
}

function activeReferenceTab(tab: AdminTab) {
  return referenceTabs.find((item) => item.key === tab) ?? referenceTabs[0];
}

function ReferenceTabs({ tab, onChange, vertical = false, snapshot }: { tab: AdminTab; onChange: (tab: AdminTab) => void; vertical?: boolean; snapshot: Snapshot }) {
  const counts: Partial<Record<AdminTab, number>> = {
    people: snapshot.people.length,
    platoons: snapshot.platoons.length,
    locations: snapshot.locations.length,
    "location-groups": snapshot.locationGroups.length,
  };
  return (
    <nav
      className={vertical ? "grid content-start gap-2" : "flex gap-2 overflow-x-auto"}
      aria-label="Разделы справочника"
    >
      {referenceTabs.map((item) => {
        const selected = tab === item.key;
        return (
          <button
            key={item.key}
            type="button"
            className={cx(
              vertical
                ? "grid min-h-14 min-w-0 grid-cols-[24px_minmax(0,1fr)_18px] items-center gap-2.5 rounded-2xl border px-3 text-left transition duration-200 motion-reduce:transition-none"
                : "inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm transition duration-200 motion-reduce:transition-none",
              selected
      ? "border-cyan/45 bg-cyan/12 text-text-primary"
                : "border-line bg-transparent text-text-secondary hover:border-line-strong hover:bg-white/5 hover:text-text-primary",
            )}
            aria-current={selected ? "page" : undefined}
            aria-pressed={selected}
            onClick={() => onChange(item.key)}
          >
            <span className={cx("grid h-8 w-8 place-items-center rounded-xl", selected ? "bg-cyan/15 text-cyan" : "bg-white/5 text-text-muted")}>
              {referenceTabIcon(item.key)}
            </span>
            <span className={vertical ? "min-w-0" : undefined}>
              <strong className={cx("block", vertical ? "truncate text-[13px]" : "font-bold")}>{item.label}</strong>
              {vertical && <span className="mt-0.5 block truncate text-[11px] text-text-muted">{item.description}</span>}
            </span>
            {vertical && (
              <span className="justify-self-end text-cyan" aria-hidden={!selected}>
                {selected ? <CheckIcon size={17} weight="bold" /> : <span className="block h-1.5 w-1.5 rounded-full bg-line-strong" />}
              </span>
            )}
            {!vertical && item.key !== "overview" && <span className="font-mono text-[11px] text-text-muted">{counts[item.key]}</span>}
          </button>
        );
      })}
    </nav>
  );
}

function ReferenceSummary({ snapshot }: { snapshot: Snapshot }) {
  const items = [
    { label: "Людей", value: snapshot.people.length, tone: "text-cyan" },
    { label: "Подразделений", value: snapshot.platoons.length, tone: "text-violet" },
    { label: "Локаций", value: snapshot.locations.length, tone: "text-green" },
    { label: "Объединений", value: snapshot.locationGroups.length, tone: "text-amber" },
  ];
  return (
    <div className="grid grid-cols-4 gap-3 max-[720px]:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-line bg-bg-panel/70 px-4 py-3">
          <strong className={cx("block font-mono text-2xl leading-none", item.tone)}>{item.value}</strong>
          <span className="mt-1.5 block text-xs text-text-muted">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function AdminPanel({
  open,
  initialTab = "people",
  snapshot,
  onClose,
  onSaved,
  layout = "drawer",
}: {
  open: boolean;
  initialTab?: AdminTab;
  snapshot: Snapshot;
  onClose: () => void;
  onSaved: (snapshot: Snapshot) => void;
  layout?: "drawer" | "page";
}) {
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const panelRef = useDialogFocus(onClose, { open });
  if (!open && layout === "drawer") return null;
  const tabMeta = activeReferenceTab(tab);
  const content = (
    <>
      {tab === "people" && (
        <PeopleAdmin snapshot={snapshot} onSaved={onSaved} />
      )}
      {tab === "platoons" && (
        <PlatoonAdmin snapshot={snapshot} onSaved={onSaved} />
      )}
      {tab === "locations" && (
        <LocationAdmin snapshot={snapshot} onSaved={onSaved} />
      )}
      {tab === "location-groups" && (
        <LocationGroupAdmin snapshot={snapshot} onSaved={onSaved} />
      )}
      {tab === "overview" && (
        <OverviewSettingsAdmin snapshot={snapshot} onSaved={onSaved} />
      )}
    </>
  );
  if (layout === "page") {
    return (
      <main ref={panelRef} className="h-dvh max-h-dvh min-h-0 overflow-y-auto overscroll-contain bg-bg-base bg-[radial-gradient(circle_at_15%_-10%,oklch(32%_0.12_302/0.22),transparent_36%),radial-gradient(circle_at_90%_8%,oklch(34%_0.11_193/0.16),transparent_30%)]">
        <div className="mx-auto grid min-h-dvh w-full max-w-360 content-start gap-6 px-6 py-6 max-[720px]:gap-4 max-[720px]:px-4 max-[720px]:py-4">
          <header className="flex min-w-0 items-start justify-between gap-5 rounded-3xl border border-line bg-bg-panel/75 px-6 py-5 max-[720px]:px-4 max-[720px]:py-4">
            <div className="min-w-0">
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan">Администрирование</p>
              <h1 className="m-0 mt-2 text-3xl font-black tracking-[-0.03em] text-text-primary max-[720px]:text-2xl">Справочники</h1>
              <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Единое место для состава, структуры и правил отображения. Изменения сохраняются сразу и доступны рабочему столу.</p>
            </div>
            <button type="button" className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-white/4 px-3 text-sm font-bold text-text-secondary transition duration-200 hover:border-line-strong hover:bg-white/8 hover:text-text-primary motion-reduce:transition-none" onClick={onClose}>
              <ArrowLeftIcon size={17} aria-hidden="true" />
              <span className="max-[520px]:hidden">К рабочему столу</span>
              <span className="sr-only min-[521px]:hidden">К рабочему столу</span>
            </button>
          </header>

          <ReferenceSummary snapshot={snapshot} />

          <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
            <ReferenceTabs tab={tab} onChange={setTab} snapshot={snapshot} vertical />
            <section className="min-w-0 overflow-hidden rounded-3xl border border-line bg-bg-panel/75" aria-labelledby="reference-content-title">
              <div className="flex min-w-0 items-start justify-between gap-4 border-b border-line px-5 py-4 max-[720px]:px-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-cyan">{referenceTabIcon(tab)}<span className="text-[11px] font-bold uppercase tracking-[0.14em]">Раздел справочника</span></div>
                  <h2 id="reference-content-title" className="m-0 mt-2 truncate text-xl font-extrabold text-text-primary">{tabMeta.label}</h2>
                  <p className="m-0 mt-1 text-sm text-text-muted">{tabMeta.description}</p>
                </div>
                <span className="shrink-0 rounded-full border border-line bg-white/4 px-2.5 py-1 text-[11px] font-bold text-text-muted">Синхронизировано</span>
              </div>
              <div className="border-b border-line px-4 py-3 lg:hidden">
                <ReferenceTabs tab={tab} onChange={setTab} snapshot={snapshot} />
              </div>
              {content}
            </section>
          </div>
        </div>
      </main>
    );
  }
  return (
    <div className="fixed inset-0 z-50 grid items-stretch justify-items-end bg-bg-overlay backdrop-blur-[10px]" onMouseDown={onClose}>
      <aside
        ref={panelRef}
        className="grid h-dvh w-[min(560px,calc(100vw-20px))] grid-rows-[auto_auto_1fr] overflow-hidden rounded-l-[20px] border border-line-strong bg-[color-mix(in_oklch,var(--bg-base)_90%,transparent)] shadow-[0_30px_90px_rgb(0_0_0/0.55)] max-[720px]:w-[calc(100vw-10px)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-line p-4">
          <h2 className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-lg" id="admin-title">{tab === "overview" ? "Настройка Обзора" : "Справочники"}</h2>
          <button
            type="button"
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-line text-text-secondary transition hover:border-line-strong hover:bg-white/7.5"
            onClick={onClose}
            aria-label="Закрыть справочники"
          >
            <XIcon size={18} />
          </button>
        </div>
        <div className="border-b border-line px-4 py-3">
          <ReferenceTabs tab={tab} onChange={setTab} snapshot={snapshot} />
        </div>
        {content}
      </aside>
    </div>
  );
}


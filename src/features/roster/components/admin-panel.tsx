import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, BuildingsIcon, CheckIcon, MapPinIcon, PencilSimple, Plus, SlidersHorizontalIcon, StackSimpleIcon, Trash, UsersThreeIcon, X } from "@phosphor-icons/react";
import { SearchSortControl, type SearchSortOption } from "@/components/search-sort-control";
import type { LocationGroup, LocationGroupConflict, LocationOption, OverviewBlockId, OverviewBlockSettings, OverviewSelection, OverviewSettings, Person, Platoon, Snapshot } from "../types";
import { FetchError, fetchJson } from "../api";
import { conscriptionLabel, cx, locationLabel, peopleForPlatoon } from "../utils";
import { SelectField } from "../../../components/select-field";
import { filterListItems, sortListItems, type ListSortState } from "@/components/list-utils";
import { overviewLocationMetrics } from "../roster-metrics";
import { cloneDefaultOverviewSettings, mergeOverviewSettings, normalizeOverviewSettings, OVERVIEW_ACTIVITY_METRICS, OVERVIEW_BLOCKS, OVERVIEW_HERO_METRICS } from "../overview-settings";


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
    window.setTimeout(() => panel?.querySelector<HTMLElement>(focusableSelector)?.focus(), 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => !element.hasAttribute("disabled"));
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

const referenceSortOptions: SearchSortOption[] = [
  { key: "alpha", label: "А–Я" },
];

const fieldClass = "min-h-10.5 min-w-0 w-full rounded-xl border border-line bg-bg-raised px-3 text-text-primary outline-none transition placeholder:text-text-muted hover:border-line-strong focus:border-cyan focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklch,var(--cyan)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-55";
const submitClass = "inline-flex min-h-10.5 items-center justify-center gap-1.5 rounded-xl border border-accent-line bg-accent-soft px-3.5 font-bold text-text-primary disabled:cursor-not-allowed disabled:opacity-55";

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
  const panelRef = useDialogFocus(open, onClose);
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
            <X size={18} />
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

function PeopleAdmin({
  snapshot,
  onSaved,
}: {
  snapshot: Snapshot;
  onSaved: (snapshot: Snapshot) => void;
}) {
  const [editing, setEditing] = useState<Person | null>(null);
  const [form, setForm] = useState({
    name: "",
    rank: "",
    conscriptionNumber: "",
    platoonId: snapshot.platoons[0]?.id ?? "",
    location: snapshot.locations[0]?.key ?? "rota",
  });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ListSortState>({ key: "alpha", direction: "asc" });
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState(false);
  function edit(person: Person) {
    setEditing(person);
    setForm({
      name: person.name,
      rank: person.rank,
      conscriptionNumber: person.conscriptionNumber ?? "",
      platoonId: person.platoonId,
      location: snapshot.locations.some((location) => location.key === person.location)
        ? person.location
        : snapshot.locations[0]?.key ?? "rota",
    });
  }
  async function save() {
    if (pending) return;
    setPending(true);
    setErrorMessage("");
    try {
      const result = await fetchJson<Snapshot>("/api/people", {
        method: "POST",
        body: JSON.stringify({ ...form, id: editing?.id }),
      });
      onSaved(result);
      setEditing(null);
      setForm({
        name: "",
        rank: "",
        conscriptionNumber: "",
        platoonId: snapshot.platoons[0]?.id ?? "",
        location: snapshot.locations[0]?.key ?? "rota",
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Сохранение не выполнено");
    } finally {
      setPending(false);
    }
  }
  async function remove(id: string) {
    if (pending) return;
    setPending(true);
    setErrorMessage("");
    try {
      onSaved(
        await fetchJson<Snapshot>("/api/people", {
          method: "DELETE",
          body: JSON.stringify({ id }),
        }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Удаление не выполнено");
    } finally {
      setPending(false);
    }
  }
  const visiblePeople = useMemo(() => sortListItems(
    filterListItems(snapshot.people, query, (person) => `${person.name} ${person.rank} ${person.conscriptionNumber ?? ""}`),
    sort,
    { label: (person) => person.name, rank: (person) => person.rank, defaultCompare: (a, b) => a.sortOrder - b.sortOrder },
  ), [query, snapshot.people, sort]);
  return (
    <div className="overflow-auto px-4 pb-4.5 pt-3">
      <FormGrid>
        <input className={fieldClass}
          aria-label="ФИО"
          placeholder="ФИО"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input className={fieldClass}
          aria-label="Звание"
          placeholder="Звание"
          value={form.rank}
          onChange={(e) => setForm({ ...form, rank: e.target.value })}
        />
        <input className={fieldClass}
          aria-label="Номер призыва"
          placeholder="Номер призыва"
          inputMode="numeric"
          maxLength={40}
          value={form.conscriptionNumber}
          onChange={(e) => setForm({ ...form, conscriptionNumber: e.target.value })}
        />
        <SelectField
          ariaLabel="Подразделение"
          value={form.platoonId}
          options={snapshot.platoons.map((p) => ({ label: p.label, value: p.id }))}
          onChange={(value) => setForm({ ...form, platoonId: value })}
          variant="admin"
        />
        <SelectField
          ariaLabel="Место"
          value={form.location}
          options={snapshot.locations.map((location) => ({ label: location.label, value: location.key }))}
          onChange={(value) => setForm({ ...form, location: value })}
          variant="admin"
        />
        {errorMessage && <p className="col-span-full m-0 text-xs text-red" role="alert">{errorMessage}</p>}
        <button
          className={submitClass}
          type="button"
          onClick={() => void save()}
          disabled={pending || !form.name || !form.rank}
        >
          <Plus size={16} />
          {editing ? "Сохранить" : "Добавить"}
        </button>
      </FormGrid>
      <SearchSortControl
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        placeholder="Найти человека по ФИО, званию или номеру призыва"
        ariaLabel="Поиск и сортировка людей"
      />
      <AdminList>
        {visiblePeople.map((person) => (
          <AdminRow
            key={person.id}
            title={person.name}
            meta={`${person.rank}${person.conscriptionNumber ? ` · ${conscriptionLabel(person.conscriptionNumber)}` : ""}`}
            onEdit={() => edit(person)}
            disabled={pending}
            onDelete={() => remove(person.id)}
          />
        ))}
      </AdminList>
    </div>
  );
}

function PlatoonAdmin({
  snapshot,
  onSaved,
}: {
  snapshot: Snapshot;
  onSaved: (snapshot: Snapshot) => void;
}) {
  const [editing, setEditing] = useState<Platoon | null>(null);
  const [label, setLabel] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ListSortState>({ key: "alpha", direction: "asc" });
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  async function save() {
    if (pending) return;
    setPending(true);
    setErrorMessage("");
    try {
      onSaved(
        await fetchJson<Snapshot>("/api/platoons", {
        method: "POST",
        body: JSON.stringify({
          id: editing?.id,
          label,
          isSystem: editing?.isSystem,
        }),
        }),
      );
      setEditing(null);
      setLabel("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Подразделение не сохранено");
    } finally {
      setPending(false);
    }
  }
  async function remove(id: string) {
    if (pending) return;
    setPending(true);
    setErrorMessage("");
    try {
      onSaved(
        await fetchJson<Snapshot>("/api/platoons", {
        method: "DELETE",
        body: JSON.stringify({ id }),
        }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Подразделение не удалено");
    } finally {
      setPending(false);
    }
  }
  const visiblePlatoons = useMemo(() => sortListItems(
    filterListItems(snapshot.platoons, query, (item) => `${item.label} ${item.isSystem ? "системное" : "пользовательское"}`),
    sort,
    { label: (item) => item.label, defaultCompare: (a, b) => a.sortOrder - b.sortOrder },
  ), [query, snapshot.platoons, sort]);
  return (
    <div className="overflow-auto px-4 pb-4.5 pt-3">
      <FormGrid>
        <input className={fieldClass}
          aria-label="Название подразделения"
          placeholder="Название подразделения"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button className={submitClass} type="button" onClick={save} disabled={pending || !label.trim()}>
          <Plus size={16} />
          {editing ? "Сохранить" : "Добавить"}
        </button>
      </FormGrid>
      {errorMessage && <p className="m-0 text-xs text-red" role="alert">{errorMessage}</p>}
      <SearchSortControl
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        options={referenceSortOptions}
        showSort={false}
        placeholder="Найти подразделение"
        ariaLabel="Поиск подразделений"
      />
      <AdminList>
        {visiblePlatoons.map((item) => (
          <AdminRow
            key={item.id}
            title={item.label}
            meta={item.isSystem ? "системное" : "пользовательское"}
            onEdit={() => {
              setEditing(item);
              setLabel(item.label);
            }}
            disabled={pending}
            onDelete={item.isSystem ? undefined : () => remove(item.id)}
          />
        ))}
      </AdminList>
    </div>
  );
}

function LocationAdmin({
  snapshot,
  onSaved,
}: {
  snapshot: Snapshot;
  onSaved: (snapshot: Snapshot) => void;
}) {
  const [editing, setEditing] = useState<LocationOption | null>(null);
  const [form, setForm] = useState({
    label: "",
    colorToken: "neutral",
    isQuick: false,
    quickCode: "",
  });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ListSortState>({ key: "alpha", direction: "asc" });
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  async function save() {
    if (pending) return;
    setPending(true);
    setErrorMessage("");
    try {
      onSaved(
        await fetchJson<Snapshot>("/api/locations", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          id: editing?.id,
          isSystem: editing?.isSystem,
          quickCode: form.quickCode || null,
        }),
        }),
      );
      setEditing(null);
      setForm({
        label: "",
        colorToken: "neutral",
        isQuick: false,
        quickCode: "",
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Локация не сохранена");
    } finally {
      setPending(false);
    }
  }
  async function remove(id: string) {
    if (pending) return;
    setPending(true);
    setErrorMessage("");
    try {
      onSaved(
        await fetchJson<Snapshot>("/api/locations", {
        method: "DELETE",
        body: JSON.stringify({ id }),
        }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Локация не удалена");
    } finally {
      setPending(false);
    }
  }
  const visibleLocations = useMemo(() => sortListItems(
    filterListItems(snapshot.locations, query, (item) => `${item.label} ${item.colorToken} ${item.quickCode ?? ""}`),
    sort,
    { label: (item) => item.label, defaultCompare: (a, b) => a.sortOrder - b.sortOrder },
  ), [query, snapshot.locations, sort]);
  return (
    <div className="overflow-auto px-4 pb-4.5 pt-3">
      <FormGrid>
        <input className={fieldClass}
          aria-label="Название локации"
          placeholder="Название локации"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
        />
        <SelectField
          ariaLabel="Цвет"
          value={form.colorToken}
          options={["neutral", "green", "blue", "amber", "cyan", "red", "violet"].map(
            (tone) => ({ label: tone, value: tone }),
          )}
          onChange={(value) => setForm({ ...form, colorToken: value })}
          variant="admin"
        />
        <StyledCheckbox
          checked={form.isQuick}
          label="Быстрая"
          onChange={(checked) => setForm({ ...form, isQuick: checked })}
        />
        <input className={fieldClass}
          aria-label="Код"
          placeholder="Код"
          maxLength={2}
          value={form.quickCode}
          onChange={(e) =>
            setForm({
              ...form,
              quickCode: e.target.value.toLocaleUpperCase("ru-RU"),
            })
          }
        />
        <button className={submitClass} type="button" onClick={() => void save()} disabled={pending || !form.label.trim()}>
          <Plus size={16} />
          {editing ? "Сохранить" : "Добавить"}
        </button>
      </FormGrid>
      {errorMessage && <p className="m-0 text-xs text-red" role="alert">{errorMessage}</p>}
      <SearchSortControl
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        options={referenceSortOptions}
        showSort={false}
        placeholder="Найти локацию"
        ariaLabel="Поиск локаций"
      />
      <AdminList>
        {visibleLocations.map((item) => (
          <AdminRow
            key={item.id}
            title={item.label}
            meta={`${item.colorToken}${item.isQuick ? `, ${item.quickCode}` : ""}`}
            onEdit={() => {
              setEditing(item);
              setForm({
                label: item.label,
                colorToken: item.colorToken,
                isQuick: item.isQuick,
                quickCode: item.quickCode ?? "",
              });
            }}
            onDelete={item.isSystem ? undefined : () => remove(item.id)}
          />
        ))}
      </AdminList>
    </div>
  );
}



function StyledCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={cx("flex min-h-10.5 w-full min-w-0 cursor-pointer items-center justify-start gap-2.5 rounded-xl border border-line bg-bg-raised px-3 text-left font-semibold text-text-secondary transition hover:border-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan", checked && "border-accent-line bg-accent-soft text-text-primary")}
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className={cx("grid h-4.75 w-4.75 shrink-0 place-items-center rounded-[7px] border border-line-strong bg-white/5.5 text-[oklch(12%_0.04_286)]", checked && "border-accent bg-[linear-gradient(135deg,var(--accent),var(--cyan))]")} aria-hidden="true">
        {checked && <CheckIcon size={14} weight="bold" />}
      </span>
      <span>{label}</span>
    </button>
  );
}

function LocationGroupAdmin({
  snapshot,
  onSaved,
}: {
  snapshot: Snapshot;
  onSaved: (snapshot: Snapshot) => void;
}) {
  const [editing, setEditing] = useState<LocationGroup | null>(null);
  const [form, setForm] = useState({
    label: "",
    colorToken: "cyan",
    enabled: true,
    sortOrder: 0,
    locationKeys: [] as string[],
  });
  const [query, setQuery] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [sort, setSort] = useState<ListSortState>({ key: "alpha", direction: "asc" });
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState(false);

  const candidates = useMemo(() => {
    const known = new Map(snapshot.locations.map((location) => [location.key, {
      key: location.key,
      label: location.label,
      count: snapshot.people.filter((person) => person.location === location.key).length,
    }]));
    for (const person of snapshot.people) {
      if (!known.has(person.location)) {
        known.set(person.location, {
          key: person.location,
          label: locationLabel(person.location, snapshot.locations),
          count: snapshot.people.filter((item) => item.location === person.location).length,
        });
      }
    }
    return Array.from(known.values()).sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [snapshot.locations, snapshot.people]);

  const visibleGroups = useMemo(() => sortListItems(
    filterListItems(snapshot.locationGroups, query, (item) => `${item.label} ${item.locationKeys.join(" ")}`),
    sort,
    { label: (item) => item.label, defaultCompare: (a, b) => a.sortOrder - b.sortOrder },
  ), [query, snapshot.locationGroups, sort]);

  const visibleCandidates = useMemo(() => {
    const needle = memberQuery.trim().toLocaleLowerCase("ru-RU");
    return needle
      ? candidates.filter((item) => `${item.label} ${item.key}`.toLocaleLowerCase("ru-RU").includes(needle))
      : candidates;
  }, [candidates, memberQuery]);

  const groupByLocation = useMemo(() => {
    const result = new Map<string, LocationGroup[]>();
    for (const group of snapshot.locationGroups) {
      for (const key of group.locationKeys) {
        const groups = result.get(key) ?? [];
        groups.push(group);
        result.set(key, groups);
      }
    }
    return result;
  }, [snapshot.locationGroups]);

  function reset() {
    setEditing(null);
    setForm({ label: "", colorToken: "cyan", enabled: true, sortOrder: 0, locationKeys: [] });
    setMemberQuery("");
    setErrorMessage("");
  }

  async function save(allowTransfer = false) {
    if (pending) return;
    setPending(true);
    setErrorMessage("");
    try {
      onSaved(await fetchJson<Snapshot>("/api/location-groups", {
        method: "POST",
        body: JSON.stringify({ ...form, id: editing?.id, allowTransfer }),
      }));
      reset();
    } catch (error) {
      const conflicts = locationGroupConflicts(error);
      if (!allowTransfer && conflicts.length) {
        const labels = conflicts.map((item) => `${locationLabel(item.locationKey, snapshot.locations)} → ${item.groupLabel}`).join("\n");
        if (window.confirm(`Места уже входят в другие объединения. Перенести их в «${form.label.trim()}»?\n\n${labels}`)) {
          await save(true);
          return;
        }
      }
      setErrorMessage(conflicts.length ? "Перенос отменён. Состав группы не изменён." : error instanceof Error ? error.message : "Сохранение не выполнено");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Удалить объединение мест? Люди и исходные места не изменятся.")) return;
    onSaved(await fetchJson<Snapshot>("/api/location-groups", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }));
    if (editing?.id === id) reset();
  }

  function edit(item: LocationGroup) {
    setEditing(item);
    setForm({
      label: item.label,
      colorToken: item.colorToken,
      enabled: item.enabled,
      sortOrder: item.sortOrder,
      locationKeys: [...item.locationKeys],
    });
    setMemberQuery("");
    setErrorMessage("");
  }

  function toggleMember(key: string) {
    setForm((current) => ({
      ...current,
      locationKeys: current.locationKeys.includes(key)
        ? current.locationKeys.filter((item) => item !== key)
        : [...current.locationKeys, key],
    }));
  }

  return (
    <div className="overflow-auto px-4 pb-4.5 pt-3">
      <p className="mb-3 text-xs leading-5 text-text-muted">
        Группы меняют только отображение обзора. Исходные места людей сохраняются.
      </p>
      <FormGrid>
        <input className={fieldClass}
          aria-label="Название объединения"
          placeholder="Например: Рота и наряд"
          value={form.label}
          onChange={(event) => setForm({ ...form, label: event.target.value })}
        />
        <SelectField
          ariaLabel="Цвет объединения"
          value={form.colorToken}
          options={["neutral", "green", "blue", "amber", "cyan", "red", "violet"].map((tone) => ({ label: tone, value: tone }))}
          onChange={(value) => setForm({ ...form, colorToken: value })}
          variant="admin"
        />
        <label className="grid gap-1.5">
          <span className="text-xs font-extrabold text-text-secondary">Порядок</span>
          <input className={fieldClass} type="number" min={0} step={1} value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) || 0 })} />
        </label>
        <StyledCheckbox checked={form.enabled} label="Показывать в обзоре" onChange={(enabled) => setForm({ ...form, enabled })} />
        <div className="col-span-full grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-text-secondary">Места в объединении: {form.locationKeys.length}</span>
            <input className={`${fieldClass} max-w-55`} aria-label="Поиск мест для объединения" placeholder="Найти место" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
            {visibleCandidates.map((item) => {
              const checked = form.locationKeys.includes(item.key);
              const currentGroups = (groupByLocation.get(item.key) ?? []).filter((group) => group.id !== editing?.id);
              const conflict = currentGroups[0];
              return (
                <button
                  type="button"
                  key={item.key}
                  role="checkbox"
                  aria-checked={checked}
                  className={cx("flex min-h-10.5 min-w-0 items-center justify-between gap-2 rounded-xl border px-3 text-left transition-colors duration-200 cursor-pointer", checked ? "border-accent-line bg-accent-soft text-text-primary" : "border-line bg-bg-raised text-text-secondary hover:border-line-strong")}
                  onClick={() => toggleMember(item.key)}
              disabled={pending}
                >
                  <span className="min-w-0 truncate font-semibold">{item.label}</span>
                  <span className={cx("shrink-0 text-right text-xs", conflict ? "text-amber" : "font-mono text-text-muted")}>{conflict ? `Сейчас: ${conflict.label}` : item.count}</span>
                </button>
              );
            })}
          </div>
        </div>
        {errorMessage && <p className="col-span-full m-0 text-xs text-red">{errorMessage}</p>}
        <button className={submitClass} type="button" onClick={() => void save()} disabled={pending || !form.label.trim()}>
          <Plus size={16} />
          {editing ? "Сохранить" : "Добавить"}
        </button>
        {editing && <button className={fieldClass} type="button" onClick={reset} disabled={pending}>Сбросить форму</button>}
      </FormGrid>
      <SearchSortControl
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        options={referenceSortOptions}
        showSort={false}
        placeholder="Найти объединение"
        ariaLabel="Поиск объединений"
      />
      <AdminList>
        {visibleGroups.map((item) => (
          <AdminRow
            key={item.id}
            title={item.label}
            meta={`${item.locationKeys.length} мест · ${item.enabled ? "включено" : "скрыто"}`}
            onEdit={() => edit(item)}
            disabled={pending}
        onDelete={() => remove(item.id)}
          />
        ))}
      </AdminList>
    </div>
  );
}

function OverviewSettingsAdmin({
  snapshot,
  onSaved,
}: {
  snapshot: Snapshot;
  onSaved: (snapshot: Snapshot) => void;
}) {
  const [baseForm, setBaseForm] = useState<OverviewSettings>(() => normalizeOverviewSettings(snapshot.overviewSettings));
  const [form, setForm] = useState<OverviewSettings>(() => normalizeOverviewSettings(snapshot.overviewSettings));
  const [draggedBlock, setDraggedBlock] = useState<OverviewBlockId | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const locationMetrics = useMemo(
    () => overviewLocationMetrics(snapshot.people, snapshot.locations, snapshot.locationGroups),
    [snapshot.people, snapshot.locations, snapshot.locationGroups],
  );
  const platoonItems = useMemo(
    () => snapshot.platoons.map((platoon) => ({
      key: platoon.id,
      label: platoon.label,
      count: peopleForPlatoon(snapshot.people, platoon.id).length,
    })),
    [snapshot.people, snapshot.platoons],
  );

  function updateBlock(id: OverviewBlockId, patch: Partial<{ visible: boolean; density: "standard" | "compact"; layout: "full" | "half" }>) {
    setForm((current) => ({
      ...current,
      blocks: current.blocks.map((block) => block.id === id ? { ...block, ...patch } as OverviewBlockSettings : block),
    }));
  }

  function updateConfig(id: OverviewBlockId, patch: Record<string, unknown>) {
    setForm((current) => ({
      ...current,
      blocks: current.blocks.map((block) => block.id === id ? { ...block, config: { ...block.config, ...patch } } as OverviewBlockSettings : block),
    }));
  }

  function updateSelection(id: OverviewBlockId, field: "locationSelection" | "platoonSelection", patch: Partial<OverviewSelection>) {
    setForm((current) => ({
      ...current,
      blocks: current.blocks.map((block) => {
        if (block.id !== id) return block;
        const selection = (block.config as Record<string, unknown>)[field] as OverviewSelection;
        return { ...block, config: { ...block.config, [field]: { ...selection, ...patch } } } as OverviewBlockSettings;
      }),
    }));
  }

  function toggleSelection(id: OverviewBlockId, field: "locationSelection" | "platoonSelection", key: string) {
    setForm((current) => ({
      ...current,
      blocks: current.blocks.map((block) => {
        if (block.id !== id) return block;
        const selection = (block.config as Record<string, unknown>)[field] as OverviewSelection;
        const keys = selection.keys.includes(key)
          ? selection.keys.filter((item) => item !== key)
          : [...selection.keys, key];
        return { ...block, config: { ...block.config, [field]: { ...selection, keys } } } as OverviewBlockSettings;
      }),
    }));
  }

  function toggleMetric(id: "hero" | "activity", key: string) {
    setForm((current) => ({
      ...current,
      blocks: current.blocks.map((block) => {
        if (block.id !== id) return block;
        const metricKeys = block.config.metricKeys as string[];
        if (metricKeys.includes(key) && metricKeys.length === 1) return block;
        return { ...block, config: { ...block.config, metricKeys: metricKeys.includes(key) ? metricKeys.filter((item) => item !== key) : [...metricKeys, key] } } as OverviewBlockSettings;
      }),
    }));
  }

  function moveBlock(id: OverviewBlockId, direction: -1 | 1) {
    setForm((current) => {
      const index = current.blocks.findIndex((block) => block.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.blocks.length) return current;
      const blocks = [...current.blocks];
      [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]];
      return { ...current, blocks };
    });
  }

  function dropBlock(targetId: OverviewBlockId) {
    if (!draggedBlock || draggedBlock === targetId) return;
    setForm((current) => {
      const from = current.blocks.findIndex((block) => block.id === draggedBlock);
      const to = current.blocks.findIndex((block) => block.id === targetId);
      if (from < 0 || to < 0) return current;
      const blocks = [...current.blocks];
      const moved = blocks.splice(from, 1)[0];
      if (!moved) return current;
      blocks.splice(to, 0, moved);
      return { ...current, blocks };
    });
    setDraggedBlock(null);
  }

  async function save() {
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const latestSnapshot = await fetchJson<Snapshot>("/api/snapshot");
      const payload = mergeOverviewSettings(
        latestSnapshot.overviewSettings,
        baseForm,
        form,
      );
      const savedSnapshot = await fetchJson<Snapshot>("/api/overview-settings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const savedSettings = normalizeOverviewSettings(savedSnapshot.overviewSettings);
      setBaseForm(savedSettings);
      setForm(savedSettings);
      onSaved(savedSnapshot);
      setSuccessMessage("Настройки обзора сохранены");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Настройки не сохранены");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-0 overflow-auto px-4 pt-3">
      <p className="mb-3 text-xs leading-5 text-text-muted">
        Настройки применяются ко всем пользователям. Для каждого блока отдельно задаются видимость, порядок, ширина, плотность и состав данных.
      </p>

      <div className="grid gap-2">
        {form.blocks.map((block, index) => {
          const label = OVERVIEW_BLOCKS.find((item) => item.id === block.id)?.label ?? block.id;
          return (
            <div
              className={cx("grid gap-3 rounded-xl border p-3 transition", block.visible ? "border-line bg-bg-raised" : "border-line bg-white/2 opacity-70")}
              key={block.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropBlock(block.id)}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="cursor-grab select-none text-lg leading-none text-text-muted"
                  draggable
                  aria-label="Перетащить блок"
                  title="Перетащить блок"
                  onDragStart={() => setDraggedBlock(block.id)}
                  onDragEnd={() => setDraggedBlock(null)}
                >⋮⋮</span>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate">{label}</strong>
                  <span className="text-[11px] text-text-muted">Порядок {index + 1}</span>
                </div>
                <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-line text-text-secondary transition hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-35" type="button" aria-label="Переместить выше" disabled={index === 0} onClick={() => moveBlock(block.id, -1)}><ArrowUpIcon size={15} /></button>
                <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-line text-text-secondary transition hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-35" type="button" aria-label="Переместить ниже" disabled={index === form.blocks.length - 1} onClick={() => moveBlock(block.id, 1)}><ArrowDownIcon size={15} /></button>
              </div>

              <div className="grid grid-cols-3 gap-2 max-[720px]:grid-cols-1">
                <StyledCheckbox checked={block.visible} label="Показывать блок" onChange={(visible) => updateBlock(block.id, { visible })} />
                <SelectField
                  ariaLabel={"Плотность блока «" + label + "»"}
                  value={block.density}
                  options={[{ label: "Обычный режим", value: "standard" }, { label: "Компактный режим", value: "compact" }]}
                  onChange={(density) => updateBlock(block.id, { density: density as "standard" | "compact" })}
                  variant="admin"
                />
                <SelectField
                  ariaLabel={"Ширина блока «" + label + "»"}
                  value={block.layout}
                  options={[{ label: "На всю ширину", value: "full" }, { label: "Половина строки", value: "half" }]}
                  onChange={(layout) => updateBlock(block.id, { layout: layout as "full" | "half" })}
                  variant="admin"
                />
              </div>

              <div className="grid gap-2 rounded-xl border border-line bg-black/8 p-2.5">
                <div>
                  <p className="m-0 text-xs font-extrabold text-text-secondary">Состав блока</p>
                  <p className="m-0 mt-1 text-[11px] leading-4 text-text-muted">Что именно будет отображаться внутри этого блока.</p>
                </div>

                {block.id === "hero" && (
                  <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
                    {OVERVIEW_HERO_METRICS.map((item) => <StyledCheckbox key={item.key} checked={block.config.metricKeys.includes(item.key)} label={item.label} onChange={() => toggleMetric("hero", item.key)} />)}
                  </div>
                )}

                {block.id === "activity" && (
                  <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
                    {OVERVIEW_ACTIVITY_METRICS.map((item) => <StyledCheckbox key={item.key} checked={block.config.metricKeys.includes(item.key)} label={item.label} onChange={() => toggleMetric("activity", item.key)} />)}
                  </div>
                )}

                {(block.id === "location-distribution" || block.id === "location-cards") && (
                  <>
                    <OverviewSelectionEditor
                      title="Какие места и объединения"
                      selection={block.config.locationSelection}
                      items={locationMetrics.map((item) => ({ key: item.key, label: item.label, count: item.count }))}
                      onModeChange={(mode) => updateSelection(block.id, "locationSelection", { mode })}
                      onToggle={(key) => toggleSelection(block.id, "locationSelection", key)}
                    />
                    {block.config.locationSelection.mode === "selected" && block.config.locationSelection.keys.length === 0 && <p className="m-0 text-xs text-amber" role="alert">Выберите хотя бы одно место или переключите режим на «Показывать все».</p>}
                    <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
                      <StyledCheckbox checked={block.config.showEmpty} label="Показывать пустые места" onChange={(showEmpty) => updateConfig(block.id, { showEmpty })} />
                      <StyledCheckbox checked={block.config.showPercent} label="Показывать проценты" onChange={(showPercent) => updateConfig(block.id, { showPercent })} />
                      <StyledCheckbox checked={block.config.expandableGroups} label="Раскрывать объединения" onChange={(expandableGroups) => updateConfig(block.id, { expandableGroups })} />
                      <StyledCheckbox checked={block.config.showMemberCounts} label="Показывать состав группы" onChange={(showMemberCounts) => updateConfig(block.id, { showMemberCounts })} />
                    </div>
                  </>
                )}

                {block.id === "platoons" && (
                  <>
                    <OverviewSelectionEditor
                      title="Какие подразделения"
                      selection={block.config.platoonSelection}
                      items={platoonItems}
                      onModeChange={(mode) => updateSelection(block.id, "platoonSelection", { mode })}
                      onToggle={(key) => toggleSelection(block.id, "platoonSelection", key)}
                    />
                    {block.config.platoonSelection.mode === "selected" && block.config.platoonSelection.keys.length === 0 && <p className="m-0 text-xs text-amber" role="alert">Выберите хотя бы одно подразделение или переключите режим на «Показывать все».</p>}
                    <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
                      <StyledCheckbox checked={block.config.showEmpty} label="Показывать пустые подразделения" onChange={(showEmpty) => updateConfig(block.id, { showEmpty })} />
                      <StyledCheckbox checked={block.config.showPercent} label="Показывать проценты и шкалы" onChange={(showPercent) => updateConfig(block.id, { showPercent })} />
                    </div>
                  </>
                )}

                {block.id === "recent-activity" && (
                  <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
                    <label className="grid gap-1.5">
                      <span className="text-xs font-extrabold text-text-secondary">Количество записей</span>
                      <input className={fieldClass} type="number" min={1} max={50} value={block.config.limit} onChange={(event) => updateConfig(block.id, { limit: Math.min(50, Math.max(1, Number(event.target.value) || 1)) })} />
                    </label>
                    <StyledCheckbox checked={block.config.showRelativeTime} label="Показывать относительное время" onChange={(showRelativeTime) => updateConfig(block.id, { showRelativeTime })} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {errorMessage && <p className="mt-3 mb-0 text-xs text-red" role="alert">{errorMessage}</p>}
      {successMessage && <p className="mt-3 mb-0 text-xs text-green" role="status">{successMessage}</p>}
      <div className="sticky bottom-0 mt-4 flex gap-2 border-t border-line bg-bg-base py-3 max-[520px]:flex-col">
        <button className={submitClass + " cursor-pointer"} type="button" disabled={saving} onClick={() => void save()}>{saving ? "Сохранение…" : "Сохранить настройки"}</button>
        <button className={fieldClass + " cursor-pointer"} type="button" disabled={saving} onClick={() => setForm(cloneDefaultOverviewSettings())}>Восстановить по умолчанию</button>
      </div>
    </div>
  );
}

function OverviewSelectionEditor({
  title,
  selection,
  items,
  onModeChange,
  onToggle,
}: {
  title: string;
  selection: OverviewSelection;
  items: Array<{ key: string; label: string; count: number }>;
  onModeChange: (mode: "all" | "selected") => void;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-xs font-extrabold text-text-secondary">{title}</span>
      <SelectField
        ariaLabel={title}
        value={selection.mode}
        options={[{ label: "Показывать все", value: "all" }, { label: "Показывать выбранные", value: "selected" }]}
        onChange={(mode) => onModeChange(mode as "all" | "selected")}
        variant="admin"
      />
      {selection.mode === "selected" && (
        <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
          {items.length === 0 && <p className="col-span-full m-0 text-xs text-text-muted">Нет доступных элементов.</p>}
          {items.map((item) => <StyledCheckbox key={item.key} checked={selection.keys.includes(item.key)} label={item.label + " · " + item.count} onChange={() => onToggle(item.key)} />)}
        </div>
      )}
    </div>
  );
}

function locationGroupConflicts(error: unknown): LocationGroupConflict[] {
  if (!(error instanceof FetchError) || error.status !== 409 || typeof error.payload !== "object" || error.payload === null) return [];
  const conflicts = (error.payload as { conflicts?: unknown }).conflicts;
  if (!Array.isArray(conflicts)) return [];
  return conflicts.filter((item): item is LocationGroupConflict => {
    if (typeof item !== "object" || item === null) return false;
    const value = item as Record<string, unknown>;
    return typeof value.locationKey === "string" && typeof value.groupId === "string" && typeof value.groupLabel === "string";
  });
}
function FormGrid({ children }: { children: ReactNode }) {
  return <div className="mb-3.5 grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">{children}</div>;
}
function AdminList({ children }: { children: ReactNode }) {
  return <div className="grid gap-2">{children}</div>;
}
const AdminRow = memo(function AdminRow({
  title,
  meta,
  onEdit,
  onDelete,
  disabled = false,
}: {
  title: string;
  meta: string;
  onEdit: () => void;
  onDelete?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_36px_36px] items-center gap-2 rounded-[13px] border border-line bg-white/[0.035] px-2.5 py-2">
      <div className="grid min-w-0 gap-0.5">
        <strong className="overflow-hidden text-ellipsis whitespace-nowrap">{title}</strong>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">{meta}</span>
      </div>
      <button className="grid h-9 w-9 cursor-pointer place-items-center rounded-[11px] border border-line bg-transparent text-text-secondary transition hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan" type="button" onClick={onEdit} aria-label="Изменить" disabled={disabled}>
        <PencilSimple size={16} />
      </button>
      {onDelete && (
        <button className="grid h-9 w-9 cursor-pointer place-items-center rounded-[11px] border border-line bg-transparent text-text-secondary transition hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan" type="button" onClick={onDelete} aria-label="Удалить" disabled={disabled}>
          <Trash size={16} />
        </button>
      )}
    </div>
  );
});

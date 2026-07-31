import { useMemo, useState } from "react";
import { ArrowCounterClockwiseIcon, XIcon } from "@phosphor-icons/react";
import { SearchSortControl, type SearchSortOption } from "@/components/search-sort-control";
import { useDialogFocus } from "@/components/use-dialog-focus";
import type { LocationOption, LogEntry, Person } from "../types";
import type { ToastBatch } from "../state";
import { abbreviateName, conscriptionLabel, cx, locationLabel, locationToken, relativeTime } from "../utils";
import { Avatar, toneClasses } from "./person-views";
import { filterListItems, sortListItems, type ListSortState } from "@/components/list-utils";

const historySortOptions: SearchSortOption[] = [
  { key: "alpha", label: "А–Я" },
];

export function LocationSheet({
  person,
  locations,
  open,
  onClose,
  onPick,
}: {
  person: Person | null;
  locations: LocationOption[];
  open: boolean;
  onClose: () => void;
  onPick: (person: Person, value: string) => void;
}) {
  const [custom, setCustom] = useState("");
  const panelRef = useDialogFocus(onClose, { open: open && !!person });
  if (!open || !person) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end justify-center bg-bg-overlay backdrop-blur-[10px]" onMouseDown={onClose}>
      <section
        ref={panelRef}
        className="m-3 max-h-[calc(100dvh-28px)] w-[min(560px,calc(100vw-24px))] overflow-auto rounded-[22px] border border-line-strong bg-[color-mix(in_oklch,var(--bg-base)_90%,transparent)] p-4.5 shadow-[0_30px_90px_rgb(0_0_0/0.55)] max-[720px]:m-0 max-[720px]:max-h-[90dvh] max-[720px]:w-full max-[720px]:rounded-b-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3.5 h-1 w-10.5 rounded-full bg-line-strong" />
        <div className="flex items-center gap-3">
          <Avatar person={person} />
          <div>
            <h2 className="m-0 text-[19px]" id="location-title">{abbreviateName(person.name)}</h2>
            <p className="mt-1 mb-0 text-text-muted">{person.rank}</p>
            {person.conscriptionNumber && <p className="mt-1 mb-0 text-text-muted">{conscriptionLabel(person.conscriptionNumber)}</p>}
          </div>
        </div>
        <h3 className="my-4.5 mb-2.5 text-[13px] text-text-secondary">Текущее местонахождение</h3>
        <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
          {locations.map((location) => (
            <button
              type="button"
              key={location.id}
              className={cx(
                "flex min-h-10.5 min-w-0 items-center gap-2 overflow-hidden rounded-[13px] border px-3 text-left text-text-primary",
                person.location === location.key ? toneClasses(location.colorToken).border : "border-line",
                person.location === location.key ? toneClasses(location.colorToken).soft : "bg-white/4",
              )}
              onClick={() => onPick(person, location.key)}
            >
              <span
                className={cx("h-2 w-2 shrink-0 rounded-full", toneClasses(location.colorToken).bg)}
              />
              {location.label}
            </button>
          ))}
        </div>
        <h3 className="my-4.5 mb-2.5 text-[13px] text-text-secondary">Другое место</h3>
        <label className="grid grid-cols-[1fr_auto] gap-2 max-[720px]:grid-cols-1">
          <span className="sr-only">Произвольное место</span>
          <input
            className="min-h-10.5 min-w-0 w-full rounded-xl border border-line bg-bg-raised px-3 text-text-primary outline-none transition focus:border-cyan focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklch,var(--cyan)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-55"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && custom.trim())
                onPick(person, custom.trim());
            }}
            placeholder="Например: госпиталь, штаб..."
          />
          <button className="min-h-10.5 rounded-xl border border-accent-line bg-accent-soft px-3.5 font-bold text-text-primary disabled:cursor-not-allowed disabled:opacity-55"
            type="button"
            disabled={!custom.trim()}
            onClick={() => {
              onPick(person, custom.trim());
              setCustom("");
            }}
          >
            Указать
          </button>
        </label>
        <button className="mt-3 min-h-10.5 w-full rounded-xl border border-accent-line bg-accent-soft px-3.5 font-bold text-text-primary" type="button" onClick={onClose}>
          Закрыть
        </button>
      </section>
    </div>
  );
}

export function HistoryPanel({
  open,
  logs,
  locations,
  onClose,
}: {
  open: boolean;
  logs: LogEntry[];
  locations: LocationOption[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ListSortState>({ key: "alpha", direction: "asc" });
  const panelRef = useDialogFocus(onClose, { open });
  const visibleLogs = useMemo(() => sortListItems(
    filterListItems(logs, query, (log) => `${log.name} ${log.from} ${log.to}`),
    sort,
    { label: (log) => log.name, defaultCompare: (a, b) => b.ts - a.ts },
  ), [logs, query, sort]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid items-stretch justify-items-end bg-bg-overlay backdrop-blur-[10px]" onMouseDown={onClose}>
      <aside
        ref={panelRef}
        className="grid h-dvh w-[min(560px,calc(100vw-20px))] grid-rows-[auto_1fr] overflow-hidden rounded-l-[20px] border border-line-strong bg-[color-mix(in_oklch,var(--bg-base)_90%,transparent)] shadow-[0_30px_90px_rgb(0_0_0/0.55)] max-[720px]:w-[calc(100vw-10px)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-line p-4">
          <h2 className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-lg" id="history-title">Журнал перемещений</h2>
          <button
            type="button"
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-line text-text-secondary transition hover:border-line-strong hover:bg-white/7.5"
            onClick={onClose}
            aria-label="Закрыть журнал"
          >
            <XIcon size={18} />
          </button>
        </div>
        <div className="overflow-auto px-4 pb-4.5 pt-3">
          {logs.length > 0 && (
            <SearchSortControl
              query={query}
              onQueryChange={setQuery}
              sort={sort}
              onSortChange={setSort}
              options={historySortOptions}
              showSort={false}
              placeholder="Найти в журнале"
              ariaLabel="Поиск в журнале перемещений"
            />
          )}
          {logs.length === 0 && (
            <p className="mt-1 text-text-muted">
              Пока нет изменений места. Они появятся здесь автоматически.
            </p>
          )}
          {visibleLogs.map((log) => (
            <div className="grid min-w-0 grid-cols-[12px_minmax(0,1fr)] gap-2.5 border-b border-line py-3 last:border-0" key={log.id}>
              <span
                className={cx(
                  "mt-1 h-2 w-2 rounded-full",
                  toneClasses(locationToken(log.to, locations)).bg,
                )}
              />
              <div>
                <p className="m-0 text-text-secondary">
                  <strong>{abbreviateName(log.name)}</strong>:{" "}
                  {locationLabel(log.from, locations)} →{" "}
                  {locationLabel(log.to, locations)}
                </p>
                <time className="text-xs text-text-muted">{relativeTime(log.ts)}</time>
              </div>
            </div>
          ))}
          {logs.length > 0 && visibleLogs.length === 0 && <p className="mt-1 text-text-muted">Поиск ничего не нашёл.</p>}
        </div>
      </aside>
    </div>
  );
}

export function Toast({
  batch,
  locations,
  onUndo,
}: {
  batch: ToastBatch;
  locations: LocationOption[];
  onUndo: () => void;
}) {
  if (!batch) return null;
  const changes = Array.from(batch.changes.values());
  const single = changes.length === 1 ? changes[0] : null;
  return (
    <div className="fixed bottom-5 left-1/2 z-70 flex max-w-[calc(100vw-24px)] -translate-x-1/2 flex-wrap items-center gap-2.5 rounded-2xl border border-line-strong bg-[color-mix(in_oklch,var(--bg-base)_90%,transparent)] px-3 py-2.5 shadow-(--shadow)" role="status" aria-live="polite">
      <span
        className={cx(
          "h-2 w-2 shrink-0 rounded-full",
          single
            ? toneClasses(locationToken(single.to, locations)).bg
            : toneClasses("accent").bg,
        )}
      />
      <strong className="text-text-primary">
        {single ? abbreviateName(single.name) : `Изменено: ${changes.length} чел.`}
      </strong>
      {single && <span className="text-text-muted">{locationLabel(single.to, locations)}</span>}
      <button className="inline-flex min-h-8.5 items-center gap-1.5 rounded-xl border border-accent-line bg-accent-soft px-3.5 font-bold text-text-primary" type="button" onClick={onUndo}>
        <ArrowCounterClockwiseIcon size={16} />
        Отменить
      </button>
    </div>
  );
}

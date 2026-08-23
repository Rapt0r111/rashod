import { memo, useMemo } from "react";
import type { ListSortState } from "@/components/list-utils";
import { SearchSortControl } from "@/components/search-sort-control";
import type { LocationGroup, LocationOption, Person } from "../types";
import { commandStripLocationMetrics } from "../roster-metrics";
import { cx } from "../utils";

function sameKeys(left: string[] | null | undefined, right: string[]) {
  if (!left || left.length !== right.length) return false;
  const wanted = new Set(right);
  return left.every((key) => wanted.has(key));
}

export const OperatorBar = memo(function OperatorBar({
  people,
  total,
  locations,
  locationGroups,
  query,
  sort,
  error,
  selectedLocationKeys,
  onQueryChange,
  onSortChange,
  onLocationFilter,
  onResetFilters,
}: {
  people: Person[];
  /** Full roster size — not affected by active filters. */
  total: number;
  locations: LocationOption[];
  locationGroups: LocationGroup[];
  query: string;
  sort: ListSortState;
  error?: string | null;
  selectedLocationKeys?: string[] | null;
  onQueryChange: (value: string) => void;
  onSortChange: (value: ListSortState) => void;
  onLocationFilter: (keys: string[]) => void;
  onResetFilters: () => void;
}) {
  const distribution = useMemo(
    () => commandStripLocationMetrics(people, locations, locationGroups),
    [people, locations, locationGroups],
  );
  const totalSelected = !selectedLocationKeys?.length;

  return (
    <section
      className="grid min-w-0 gap-3 max-[900px]:top-17"
      aria-label="Оперативная панель личного состава"
    >
      <div
        className="grid min-w-0 auto-cols-[minmax(8rem,11rem)] grid-flow-col justify-start gap-2 overflow-x-auto overscroll-x-contain pb-0.5"
        aria-live="polite"
        aria-label="Распределение по местам"
      >
        <button
          type="button"
          className={cx(
            "flex min-h-11 min-w-29 flex-col items-start justify-between gap-1.5 rounded-[10px] border px-3 py-2.5 text-left transition-[border-color,background-color,transform] duration-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
            totalSelected
              ? "border-accent bg-accent"
              : "border-line bg-bg-panel hover:border-line-strong",
          )}
          title="Сбросить фильтры и показать весь список"
          aria-label={`Список ${total}. Сбросить фильтры`}
          aria-pressed={totalSelected}
          onClick={onResetFilters}
        >
          <span className={cx("text-xs font-semibold", totalSelected ? "text-[oklch(12%_0.04_286)]" : "text-text-secondary")}>
            список
          </span>
          <strong
            className={cx(
              "font-mono text-[2.25rem] leading-none tracking-[-0.04em]",
              totalSelected ? "text-[oklch(12%_0.04_286)]" : "text-text-primary",
            )}
          >
            {total}
          </strong>
        </button>
        {distribution.map((item) => {
          const selected = sameKeys(selectedLocationKeys, item.locationKeys);
          return (
            <button
              key={item.key}
              type="button"
              className={cx(
                "flex min-h-11 min-w-29 flex-col items-start justify-between gap-1.5 rounded-[10px] border px-3 py-2.5 text-left transition-[border-color,background-color,transform] duration-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
                selected
                  ? "border-accent bg-accent"
                  : "border-line bg-bg-panel hover:border-line-strong",
              )}
              onClick={() => onLocationFilter(item.locationKeys)}
              aria-label={`Показать людей в месте: ${item.label}`}
              aria-pressed={selected}
              title={`Показать людей в месте: ${item.label}`}
            >
              <span
                className={cx(
                  "max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold",
                  selected ? "text-[oklch(12%_0.04_286)]" : "text-text-secondary",
                )}
              >
                {item.label}
              </span>
              <b
                className={cx(
                  "font-mono text-[2.25rem] leading-none tracking-[-0.04em]",
                  selected ? "text-[oklch(12%_0.04_286)]" : "text-text-primary",
                )}
              >
                {item.count}
              </b>
            </button>
          );
        })}
      </div>
      <SearchSortControl
        query={query}
        onQueryChange={onQueryChange}
        sort={sort}
        onSortChange={onSortChange}
        placeholder="Найти человека по ФИО, званию или номеру призыва"
        ariaLabel="Поиск человека и сортировка результатов"
        compact
        flush
      />
      {error && (
        <p className="m-0 rounded-xl border border-red/40 bg-red/10 px-3 py-2 text-xs font-semibold text-red" role="alert">
          {error}
        </p>
      )}
    </section>
  );
});

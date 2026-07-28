import { memo, useMemo } from "react";
import type { ListSortState } from "@/components/list-utils";
import { SearchSortControl } from "@/components/search-sort-control";
import type { LocationGroup, LocationOption, Person } from "../types";
import { overviewLocationMetrics } from "../roster-metrics";
import { cx } from "../utils";
import { toneClasses } from "./person-views";

export const OperatorBar = memo(function OperatorBar({
  people,
  locations,
  locationGroups,
  total,
  rota,
  query,
  sort,
  error,
  onQueryChange,
  onSortChange,
  onLocationFilter,
}: {
  people: Person[];
  locations: LocationOption[];
  locationGroups: LocationGroup[];
  total: number;
  rota: number;
  query: string;
  sort: ListSortState;
  error?: string | null;
  onQueryChange: (value: string) => void;
  onSortChange: (value: ListSortState) => void;
  onLocationFilter: (keys: string[]) => void;
}) {
  const distribution = useMemo(
    () => overviewLocationMetrics(people, locations, locationGroups).filter((item) => item.count > 0),
    [people, locations, locationGroups],
  );

  return (
    <section
      className="mb-4 grid min-w-0 gap-2 rounded-2xl border border-line bg-[color-mix(in_oklch,var(--bg-base)_94%,transparent)] p-2.5 shadow-[0_14px_34px_rgb(0_0_0/0.2)] backdrop-blur-xl max-[900px]:top-17 max-[900px]:-mx-4 max-[900px]:rounded-none max-[900px]:border-x-0 max-[900px]:px-4"
      aria-label="Оперативная панель личного состава"
    >
      <div
        className="flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain pb-0.5"
        aria-live="polite"
        aria-label="Распределение по местам"
      >
        <div className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-accent-line bg-accent-soft px-3">
          <strong className="font-mono text-lg leading-none text-accent">{total}</strong>
          <span className="text-xs font-semibold text-text-secondary">всего</span>
        </div>
        <div className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-white/4 px-3">
          <strong className="font-mono text-lg leading-none text-green">{rota}</strong>
          <span className="text-xs font-semibold text-text-secondary">в роте</span>
        </div>
        <span className="h-7 w-px shrink-0 bg-line" aria-hidden="true" />
        {distribution.map((item) => {
          const tone = toneClasses(item.token);
          return (
            <button
              key={item.key}
              type="button"
              className={cx(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-left transition-[background,border-color,color,transform] duration-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
                tone.border,
                tone.soft,
                "hover:brightness-110",
              )}
              onClick={() => onLocationFilter(item.locationKeys)}
              aria-label={`Показать людей в месте: ${item.label}`}
              title={`Показать людей в месте: ${item.label}`}
            >
              <i className={cx("h-2 w-2 shrink-0 rounded-full", tone.bg)} aria-hidden="true" />
              <span className="max-w-37.5 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-text-primary">
                {item.label}
              </span>
              <b className={cx("font-mono text-sm", tone.text)}>{item.count}</b>
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

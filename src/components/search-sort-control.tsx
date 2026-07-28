"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ListMagnifyingGlassIcon,
  XIcon,
} from "@phosphor-icons/react";
import { SelectField } from "./select-field";
import type { ListSortKey, ListSortState } from "./list-utils";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type SearchSortOption = {
  key: ListSortKey;
  label: string;
};

const DEFAULT_OPTIONS: SearchSortOption[] = [
  { key: "alpha", label: "А–Я" },
  { key: "rank", label: "По званию" },
];

export function SearchSortControl({
  query,
  onQueryChange,
  sort,
  onSortChange,
  options = DEFAULT_OPTIONS,
  placeholder = "Поиск",
  ariaLabel = "Поиск и сортировка списка",
  compact = false,
  flush = false,
  autoFocus = false,
  showSearch = true,
  showSort = true,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  sort: ListSortState;
  onSortChange: (value: ListSortState) => void;
  options?: SearchSortOption[];
  placeholder?: string;
  ariaLabel?: string;
  compact?: boolean;
  flush?: boolean;
  autoFocus?: boolean;
  showSearch?: boolean;
  showSort?: boolean;
}) {
  const selectedOption =
    options.find((option) => option.key === sort.key) ?? options[0];
  const canChangeDirection = options.length > 1 && sort.key !== "default";
  const shouldShowSort = showSort && options.length > 1;

  function pickSort(key: ListSortKey) {
    const direction = key === "rank" ? "desc" : "asc";
    onSortChange({ key, direction });
  }

  function toggleDirection() {
    onSortChange({
      ...sort,
      direction: sort.direction === "asc" ? "desc" : "asc",
    });
  }

  return (
    <section
      className={cx(
        "flex min-w-0 flex-1 flex-wrap items-center gap-2 pb-3.5",
        flush && "pb-0",
        compact && "basis-full sm:basis-110",
      )}
      aria-label={ariaLabel}
    >
      {showSearch && (
        <div
          className={cx(
            "flex min-h-9.5 min-w-0 flex-1 basis-full items-center gap-2 rounded-[11px] border border-line bg-white/4.5 px-2.5 text-text-muted transition-[border-color,box-shadow] duration-200 focus-within:border-accent-line focus-within:shadow-[0_0_0_3px_var(--accent-soft)] sm:basis-65 sm:min-w-45",
            compact && "min-h-10.5",
          )}
        >
          <ListMagnifyingGlassIcon
            className="shrink-0"
            size={17}
            aria-hidden="true"
          />
          <input
            className="min-w-0 w-full border-0 bg-transparent text-text-primary outline-none placeholder:text-text-muted"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            type="search"
            autoFocus={autoFocus}
          />
          {query && (
            <button
              type="button"
              className="inline-grid h-6.5 w-6.5 shrink-0 place-items-center rounded-lg border border-line text-text-muted transition-colors duration-200 hover:border-accent-line hover:text-text-primary focus-visible:border-accent-line"
              onClick={() => onQueryChange("")}
              aria-label="Очистить поиск"
            >
              <XIcon size={15} weight="bold" />
            </button>
          )}
        </div>
      )}
      {shouldShowSort && (
        <div
          className="flex w-full min-w-0 shrink-0 items-center gap-1.5 sm:w-auto"
          aria-label="Сортировка"
        >
          <SelectField
            ariaLabel="Вид сортировки"
            value={sort.key}
            options={options.map((option) => ({
              label: option.label,
              value: option.key,
            }))}
            onChange={(value) => pickSort(value as ListSortKey)}
            variant="groups"
            className="min-w-0 flex-1 sm:w-38.75 sm:flex-none"
          />
          {canChangeDirection && (
            <button
              type="button"
              className="inline-grid h-10.5 w-10.5 shrink-0 place-items-center rounded-xl border border-line bg-bg-raised text-text-muted transition-[border-color,background,color] duration-200 hover:border-accent-line hover:bg-accent-soft hover:text-text-primary focus-visible:border-accent-line"
              onClick={toggleDirection}
              aria-label={`Направление: ${sort.direction === "asc" ? "по возрастанию" : "по убыванию"}`}
            >
              {sort.direction === "asc" ? (
                <ArrowUpIcon size={15} />
              ) : (
                <ArrowDownIcon size={15} />
              )}
            </button>
          )}
        </div>
      )}
      {compact && (
        <span className="sr-only">
          Текущая сортировка: {selectedOption?.label}
        </span>
      )}
    </section>
  );
}

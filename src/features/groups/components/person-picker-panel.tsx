"use client";

import { useMemo, useState } from "react";
import { WarningIcon } from "@phosphor-icons/react";
import {
  filterListItems,
  sortListItems,
  type ListSortState,
} from "@/components/list-utils";
import { SearchSortControl } from "@/components/search-sort-control";
import type { Person } from "../../roster/types";
import { abbreviateName, conscriptionLabel, getInitials } from "../../roster/utils";
import type { GroupConflict } from "../types";
import { formatDateLabel } from "../utils";
import { Drawer } from "./drawer";
import { EmptyState } from "./empty-state";

type PendingConflict = {
  personId: string;
  conflicts: GroupConflict[];
} | null;

export function PersonPickerPanel({
  title,
  people,
  pendingConflict,
  selectedDate,
  isBusy,
  onClose,
  onPick,
  onConfirmConflict,
}: {
  title: string;
  people: Person[];
  pendingConflict: PendingConflict;
  selectedDate: string;
  onClose: () => void;
  onPick: (personId: string) => void;
  onConfirmConflict: () => void;
  isBusy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ListSortState>({
    key: "alpha",
    direction: "asc",
  });
  const filtered = useMemo(
    () =>
      sortListItems(
        filterListItems(
          people,
          query,
          (person) => `${person.rank} ${person.name} ${person.conscriptionNumber ?? ""}`,
        ),
        sort,
        {
          label: (person) => person.name,
          rank: (person) => person.rank,
          defaultCompare: (a, b) => a.sortOrder - b.sortOrder,
        },
      ),
    [people, query, sort],
  );
  const pendingPerson = pendingConflict
    ? people.find((person) => person.id === pendingConflict.personId)
    : null;

  return (
    <Drawer title={title} onClose={onClose}>
      <SearchSortControl
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        placeholder="Поиск по ФИО, званию или номеру призыва"
        ariaLabel="Поиск и сортировка кандидатов"
        autoFocus
      />
      {pendingConflict && (
        <div
          className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] border border-[oklch(78%_0.16_74/0.38)] bg-[oklch(78%_0.16_74/0.1)] p-2.5 text-amber sm:grid-cols-[auto_minmax(0,1fr)_auto]"
          role="alert"
        >
          <WarningIcon size={18} />
          <div className="min-w-0">
            <strong className="block">Назначение пересекается</strong>
            <span className="block wrap-anywhere text-xs">
              {pendingPerson ? `${abbreviateName(pendingPerson.name)} · ` : ""}
              {formatDateLabel(selectedDate)}. Уже есть в: {pendingConflict.conflicts
                .map((item) => item.groupName)
                .join(", ")}.
            </span>
          </div>
          <button
            type="button"
            className="col-span-full inline-flex min-h-8.5 max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-[oklch(78%_0.16_74/0.5)] bg-[oklch(78%_0.16_74/0.16)] px-2.5 text-center text-[13px] font-extrabold text-text-primary transition-[background,border-color,transform] duration-200 hover:border-amber hover:bg-[oklch(78%_0.16_74/0.22)] cursor-pointer active:translate-y-px sm:col-span-1"
            onClick={onConfirmConflict}
            disabled={isBusy}
          >
            Назначить с конфликтом
          </button>
        </div>
      )}
      <div className="grid gap-1.75">
        {filtered.length === 0 ? (
          <EmptyState
            title={people.length === 0 ? "Нет кандидатов на выбранную дату" : "Никого не найдено"}
            text={
              people.length === 0
                ? "Проверьте исключения и правила группы или выберите другую дату."
                : "Измените поиск или правила кандидатов."
            }
          />
        ) : (
          filtered.map((person) => (
            <button
              key={person.id}
              type="button"
              className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] border border-line bg-[oklch(100%_0_0/0.035)] p-2.25 text-left text-text-primary transition-[border-color,background,transform] duration-200 hover:border-accent-line hover:bg-[oklch(100%_0_0/0.065)] cursor-pointer active:translate-y-px"
              onClick={() => onPick(person.id)}
              disabled={isBusy}
            >
              <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-accent-soft text-[11px] font-extrabold text-accent">
                {getInitials(person.name)}
              </span>
              <span className="grid min-w-0 gap-0.5">
                <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                  {abbreviateName(person.name)}
                </strong>
                <small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
                  {person.rank}
                </small>
                {person.conscriptionNumber && (
                  <small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
                    {conscriptionLabel(person.conscriptionNumber)}
                  </small>
                )}
              </span>
            </button>
          ))
        )}
      </div>
    </Drawer>
  );
}


"use client";

import { useMemo, useState } from "react";
import {
  filterListItems,
  sortListItems,
  type ListSortState,
} from "@/components/list-utils";
import { SearchSortControl } from "@/components/search-sort-control";
import {
  dateFromKey,
  scheduleDateRange,
  schedulePresetRange,
  type SchedulePreset,
} from "@/features/schedule/logic";
import type { Person } from "../../roster/types";
import { abbreviateName, conscriptionLabel, getInitials } from "../../roster/utils";
import { Drawer } from "./drawer";
import { EmptyState } from "./empty-state";

export function PersonPickerPanel({
  title,
  people,
  candidatePeople = people,
  availablePeopleByDate = {},
  initialDate,
  isBusy,
  onClose,
  onPick,
}: {
  title: string;
  people: Person[];
  candidatePeople?: Person[];
  availablePeopleByDate?: Record<string, Person[]>;
  initialDate: string;
  onClose: () => void;
  onPick: (personId: string, from: string, to: string) => void;
  isBusy: boolean;
}) {
  const [from, setFrom] = useState(initialDate);
  const [to, setTo] = useState(initialDate);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ListSortState>({ key: "alpha", direction: "asc" });
  const dates = useMemo(() => scheduleDateRange(from, to), [from, to]);
  const rangePeople = useMemo(() => {
    if (!dates) return [];
    const datePeople = dates.map((date) => availablePeopleByDate[date]);
    if (datePeople.every((items) => items !== undefined)) {
      const availableIds = new Set(datePeople[0]?.map((person) => person.id) ?? []);
      for (const items of datePeople.slice(1)) {
        const ids = new Set(items?.map((person) => person.id) ?? []);
        for (const id of availableIds) if (!ids.has(id)) availableIds.delete(id);
      }
      return candidatePeople.filter((person) => availableIds.has(person.id));
    }
    return dates.length === 1 ? people : candidatePeople;
  }, [availablePeopleByDate, candidatePeople, dates, people]);
  const filtered = useMemo(
    () => sortListItems(
      filterListItems(rangePeople, query, (person) => `${person.rank} ${person.name} ${person.conscriptionNumber ?? ""}`),
      sort,
      {
        label: (person) => person.name,
        rank: (person) => person.rank,
        defaultCompare: (a, b) => a.sortOrder - b.sortOrder,
      },
    ),
    [query, rangePeople, sort],
  );

  function choosePreset(preset: SchedulePreset) {
    const anchor = scheduleDateRange(from, from) ? dateFromKey(from) : dateFromKey(initialDate);
    const range = schedulePresetRange(preset, anchor);
    setFrom(range.from);
    setTo(range.to);
  }

  const rangeLabel = dates
    ? dates.length === 1 ? "1 дата" : `${dates.length} дат`
    : "некорректный период";

  return (
    <Drawer title={title} onClose={onClose}>
      <div className="grid gap-2 rounded-[14px] border border-line bg-bg-panel/70 p-2.5">
        <div className="grid gap-2 min-[480px]:grid-cols-2">
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">
            С
            <input
              className="min-h-10 rounded-[11px] border border-line bg-black/15 px-2.5 text-sm font-semibold text-text-primary outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/15"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">
            По
            <input
              className="min-h-10 rounded-[11px] border border-line bg-black/15 px-2.5 text-sm font-semibold text-text-primary outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/15"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Период назначения">
          {([
            ["today", "Дата"],
            ["seven", "7 дней"],
            ["week", "Неделя"],
            ["thirty", "30 дней"],
            ["month", "Месяц"],
            ["year", "Год"],
          ] as const).map(([preset, label]) => (
            <button
              key={preset}
              type="button"
              className="min-h-8.5 rounded-lg border border-line bg-white/5 px-2.5 text-xs font-bold text-text-secondary transition hover:border-line-strong hover:bg-white/9 hover:text-text-primary"
              onClick={() => choosePreset(preset)}
              disabled={isBusy}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="m-0 text-xs leading-5 text-text-muted">
          Назначение будет добавлено на {rangeLabel}. Нерабочие, исключённые, занятые или конфликтующие даты пропускаются с сохранением строгих правил.
        </p>
      </div>
      <SearchSortControl
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        placeholder="Поиск по ФИО, званию или номеру призыва"
        ariaLabel="Поиск и сортировка кандидатов"
        autoFocus
      />
      <div className="grid gap-1.75">
        {filtered.length === 0 ? (
          <EmptyState
            title={!dates ? "Выберите корректный период" : rangePeople.length === 0 ? "Нет кандидатов на выбранный период" : "Никого не найдено"}
            text={!dates ? "Период должен быть от одной до 366 календарных дат." : rangePeople.length === 0 ? "Проверьте исключения и правила группы или выберите другой период." : "Измените поиск или правила кандидатов."}
          />
        ) : filtered.map((person) => (
          <button
            key={person.id}
            type="button"
            className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] border border-line bg-[oklch(100%_0_0/0.035)] p-2.25 text-left text-text-primary transition-[border-color,background,transform] duration-200 hover:border-accent-line hover:bg-[oklch(100%_0_0/0.065)] cursor-pointer active:translate-y-px"
            onClick={() => dates && onPick(person.id, from, to)}
            disabled={isBusy}
          >
            <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-accent-soft text-[11px] font-extrabold text-accent">{getInitials(person.name)}</span>
            <span className="grid min-w-0 gap-0.5">
              <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">{abbreviateName(person.name)}</strong>
              <small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">{person.rank}</small>
              {person.conscriptionNumber && <small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">{conscriptionLabel(person.conscriptionNumber)}</small>}
            </span>
          </button>
        ))}
      </div>
    </Drawer>
  );
}

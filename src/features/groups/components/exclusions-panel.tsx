"use client";

import { useMemo, useState } from "react";
import { TrashIcon, UserMinusIcon, XIcon } from "@phosphor-icons/react";
import { SelectField } from "@/components/select-field";
import {
  SearchSortControl,
  type SearchSortOption,
} from "@/components/search-sort-control";
import {
  filterListItems,
  sortListItems,
  type ListSortState,
} from "@/components/list-utils";
import type { Person } from "../../roster/types";
import { abbreviateName, conscriptionLabel } from "../../roster/utils";
import type { DutyGroupSnapshot } from "../types";
import { DAY_NAMES } from "../utils";
import { EXCLUSION_REASON_MAX_LENGTH } from "./constants";
import { Drawer } from "./drawer";

const exclusionSortOptions: SearchSortOption[] = [
  { key: "alpha", label: "А–Я" },
];

export function ExclusionsPanel({
  item,
  isBusy,
  onClose,
  onExclude,
  onInclude,
}: {
  item: DutyGroupSnapshot;
  onClose: () => void;
  onExclude: (
    personId: string,
    dayOfWeek: number | null,
    reason: string,
  ) => Promise<unknown>;
  onInclude: (exclusionId: string) => Promise<unknown>;
  isBusy: boolean;
}) {
  const [personId, setPersonId] = useState("");
  const [exclusionQuery, setExclusionQuery] = useState("");
  const [exclusionSort, setExclusionSort] = useState<ListSortState>({
    key: "alpha",
    direction: "asc",
  });
  const [day, setDay] = useState("");
  const [reason, setReason] = useState("");
  const excludedPersonIds = useMemo(
    () => new Set(item.exclusions.map((exclusion) => exclusion.personId)),
    [item.exclusions],
  );
  const peopleOptions = useMemo(() => {
    return item.candidatePeople
      .filter((person) => !excludedPersonIds.has(person.id))
      .map((person) => ({
        value: person.id,
        label: `${abbreviateName(person.name)} · ${person.rank}${person.conscriptionNumber ? ` · ${conscriptionLabel(person.conscriptionNumber)}` : ""}`,
      }));
  }, [excludedPersonIds, item.candidatePeople]);
  const visibleExclusions = useMemo(
    () =>
      sortListItems(
        filterListItems(item.exclusions, exclusionQuery, (exclusion) => {
          const dayLabel =
            exclusion.dayOfWeek === null
              ? "Всегда"
              : DAY_NAMES[exclusion.dayOfWeek];
          return [
            exclusion.personName ?? exclusion.personId,
            exclusion.personRank ?? "",
            exclusion.personConscriptionNumber ?? "",
            exclusion.reason,
            dayLabel,
          ].join(" ");
        }),
        exclusionSort,
        {
          label: (exclusion) => exclusion.personName ?? exclusion.personId,
          rank: (exclusion) => exclusion.personRank ?? "",
          defaultCompare: (a, b) => a.createdAt - b.createdAt,
        },
      ),
    [exclusionQuery, exclusionSort, item.exclusions],
  );
  const dayOptions = [
    { value: "", label: "Всегда" },
    ...[0, 1, 2, 3, 4, 5, 6].map((item) => ({
      value: String(item),
      label: DAY_NAMES[item],
    })),
  ];
  const selectedPersonId = peopleOptions.some(
    (option) => option.value === personId,
  ) ? personId : "";

  return (
    <Drawer title="Исключения" onClose={onClose}>
      <SearchSortControl
        query={exclusionQuery}
        onQueryChange={setExclusionQuery}
        sort={exclusionSort}
        onSortChange={setExclusionSort}
        placeholder="Поиск по исключённым"
      />
      <div className="grid gap-1.75">
        {item.exclusions.length === 0 ? (
          <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
            Постоянных исключений нет.
          </p>
        ) : visibleExclusions.length === 0 ? (
          <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
            Поиск ничего не нашёл.
          </p>
        ) : (
          visibleExclusions.map((exclusion) => (
            <div
              key={exclusion.id}
              className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 rounded-[14px] border border-line bg-[oklch(100%_0_0/0.035)] p-2.25 text-left text-text-primary"
            >
              <span className="grid min-w-0 gap-0.5">
                <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                  {exclusion.personName
                    ? abbreviateName(exclusion.personName)
                    : exclusion.personId}
                </strong>
                <small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
                  {exclusion.personRank && `${exclusion.personRank} · `}
                  {exclusion.personConscriptionNumber && conscriptionLabel(exclusion.personConscriptionNumber)}
                  {!exclusion.personRank && !exclusion.personConscriptionNumber && "Без звания"}
                  {" · "}
                  {exclusion.dayOfWeek === null
                    ? "Всегда"
                    : DAY_NAMES[exclusion.dayOfWeek]}
                </small>
              </span>
              <button
                type="button"
                className="inline-flex h-8.5 min-h-8.5 w-8.5 max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-line bg-[oklch(100%_0_0/0.04)] p-0 text-text-secondary transition-[background,border-color,transform] duration-200 hover:border-[oklch(69%_0.18_28/0.45)] hover:text-red cursor-pointer active:translate-y-px"
                onClick={() => onInclude(exclusion.id)}
                disabled={isBusy}
                aria-label={`Снять исключение: ${exclusion.personName ?? exclusion.personId}`}
              >
                <XIcon size={16} />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="grid min-w-0 gap-1.75">
        <span>Добавить человека</span>
        <SelectField
          ariaLabel="Добавить человека в исключения"
          value={selectedPersonId}
          options={peopleOptions}
          onChange={setPersonId}
          placeholder="Выберите человека"
          searchPlaceholder="Поиск кого исключить"
        />
      </div>
      <div className="grid min-w-0 gap-1.75">
        <span>День</span>
        <SelectField
          ariaLabel="День исключения"
          value={day}
          options={dayOptions}
          onChange={setDay}
        />
      </div>
      <label className="grid min-w-0 gap-1.75">
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-text-secondary">
          Причина
        </span>
        <input
          className="w-full min-w-0 rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-2.75 py-2.5 text-base text-text-primary outline-none focus:border-cyan focus:ring-2 focus:ring-[oklch(77%_0.14_191/0.1)]"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={EXCLUSION_REASON_MAX_LENGTH}
          placeholder="Например: медчасть, закреплён за другим нарядом"
        />
      </label>
      {peopleOptions.length === 0 && (
        <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
          Все подходящие люди уже в исключениях или не найдены.
        </p>
      )}
      <button
        type="button"
        className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-accent-line bg-accent px-3.25 text-center text-[13px] font-extrabold text-[oklch(98%_0.01_286)] transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
        disabled={isBusy || !selectedPersonId}
        onClick={() =>
          onExclude(selectedPersonId, day === "" ? null : Number(day), reason)
        }
      >
        Добавить исключение
      </button>
    </Drawer>
  );
}


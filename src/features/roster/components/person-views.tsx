"use client";

import { createContext, memo, useContext, type ReactNode } from "react";
import { CheckIcon, MapPinIcon } from "@phosphor-icons/react";
import type { LocationOption, Person } from "../types";
import { abbreviateName, cx, getInitials, locationLabel, locationToken } from "../utils";

const toneMap: Record<string, { text: string; bg: string; border: string; soft: string }> = {
  accent: { text: "text-accent", bg: "bg-accent", border: "border-accent-line", soft: "bg-accent-soft" },
  green: { text: "text-green", bg: "bg-green", border: "border-[color-mix(in_oklch,var(--green)_42%,transparent)]", soft: "bg-[color-mix(in_oklch,var(--green)_14%,transparent)]" },
  blue: { text: "text-blue", bg: "bg-blue", border: "border-[color-mix(in_oklch,var(--blue)_42%,transparent)]", soft: "bg-[color-mix(in_oklch,var(--blue)_14%,transparent)]" },
  amber: { text: "text-amber", bg: "bg-amber", border: "border-[color-mix(in_oklch,var(--amber)_42%,transparent)]", soft: "bg-[color-mix(in_oklch,var(--amber)_14%,transparent)]" },
  cyan: { text: "text-cyan", bg: "bg-cyan", border: "border-[color-mix(in_oklch,var(--cyan)_42%,transparent)]", soft: "bg-[color-mix(in_oklch,var(--cyan)_14%,transparent)]" },
  red: { text: "text-red", bg: "bg-red", border: "border-[color-mix(in_oklch,var(--red)_42%,transparent)]", soft: "bg-[color-mix(in_oklch,var(--red)_14%,transparent)]" },
  violet: { text: "text-violet", bg: "bg-violet", border: "border-[color-mix(in_oklch,var(--violet)_42%,transparent)]", soft: "bg-[color-mix(in_oklch,var(--violet)_14%,transparent)]" },
  neutral: { text: "text-neutral", bg: "bg-neutral", border: "border-[color-mix(in_oklch,var(--neutral)_42%,transparent)]", soft: "bg-[color-mix(in_oklch,var(--neutral)_14%,transparent)]" },
};

export function toneClasses(token: string) {
  return toneMap[token] ?? toneMap.neutral;
}

const actionButtonClass =
  "grid size-11 min-h-11 min-w-11 shrink-0 place-items-center rounded-[10px] border border-line bg-white/[0.035] text-sm font-extrabold text-text-secondary transition duration-200 active:translate-y-px min-[561px]:size-9 min-[561px]:min-h-9 min-[561px]:min-w-9";

const cellClass = "px-2 py-1 align-middle min-[561px]:px-2.5";

type RosterColumns = { showRank: boolean; showContext: boolean };

const RosterColumnsContext = createContext<RosterColumns>({
  showRank: true,
  showContext: false,
});

function ColumnChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cx(
        "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3 text-xs transition-[background,border-color,box-shadow,color,filter] duration-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg-panel",
        pressed
          ? "border-accent bg-accent font-extrabold text-[oklch(12%_0.04_286)] hover:brightness-110"
          : "border-line bg-white/4 text-text-secondary hover:border-line-strong hover:bg-white/8 hover:text-text-primary",
      )}
      onClick={onClick}
    >
      {pressed ? <CheckIcon size={14} weight="bold" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function RosterColumnToggles({
  showRank,
  showPlatoon,
  onToggle,
}: {
  showRank: boolean;
  showPlatoon: boolean;
  onToggle: (column: "rank" | "platoon") => void;
}) {
  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-1.5"
      aria-label="Столбцы таблицы"
    >
      <span className="mr-0.5 text-xs font-semibold text-text-muted">Столбцы</span>
      <ColumnChip pressed={showRank} onClick={() => onToggle("rank")}>
        Звание
      </ColumnChip>
      <ColumnChip pressed={showPlatoon} onClick={() => onToggle("platoon")}>
        Взвод
      </ColumnChip>
    </div>
  );
}

export function RosterTable({
  children,
  showRank = true,
  showContext = false,
}: {
  children: ReactNode;
  showRank?: boolean;
  showContext?: boolean;
}) {
  return (
    <RosterColumnsContext.Provider value={{ showRank, showContext }}>
      <div className="min-w-0 overflow-x-auto rounded-[10px] border border-line">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-bg-raised text-[11px] font-semibold text-text-muted">
              {showRank ? (
                <th className={cx(cellClass, "whitespace-nowrap font-semibold")}>Звание</th>
              ) : null}
              <th className={cx(cellClass, "w-full font-semibold")}>Фамилия</th>
              <th className={cx(cellClass, "whitespace-nowrap font-semibold")}>Место</th>
              {showContext ? (
                <th className={cx(cellClass, "whitespace-nowrap font-semibold")}>Взвод</th>
              ) : null}
              <th className={cx(cellClass, "w-[1%] whitespace-nowrap font-semibold")}>Назначить</th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </RosterColumnsContext.Provider>
  );
}

export const RosterRow = memo(function RosterRow({
  person,
  locations,
  flash,
  pending,
  contextLabel,
  canWrite = true,
  selected = false,
  onToggleSelect,
  onLocation,
  onMore,
}: {
  person: Person;
  locations: LocationOption[];
  flash: boolean;
  pending?: boolean;
  contextLabel?: string;
  canWrite?: boolean;
  selected?: boolean;
  onToggleSelect?: (personId: string) => void;
  onLocation: (person: Person, to: string) => void;
  onMore: (personId: string) => void;
}) {
  const { showRank, showContext } = useContext(RosterColumnsContext);
  const quick = locations.filter((location) => location.isQuick);
  const canSelect = canWrite && !!onToggleSelect;
  return (
    <tr
      className={cx(
        "border-b border-line bg-bg-panel last:border-b-0",
        flash && !selected && "bg-[color-mix(in_oklch,var(--accent)_13%,transparent)]!",
        selected && "bg-[color-mix(in_oklch,var(--cyan)_12%,transparent)]",
      )}
      aria-busy={pending || undefined}
      aria-selected={canSelect ? selected : undefined}
    >
      {showRank ? (
        <td className={cx(cellClass, "whitespace-nowrap text-xs text-text-muted")}>
          <span>{person.rank}</span>
        </td>
      ) : null}
      <td className={cx(cellClass, "min-w-0")}>
        <div
          className={cx(
            "min-w-0 rounded-[10px] py-px",
            canSelect && "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-cyan",
          )}
          role={canSelect ? "button" : undefined}
          tabIndex={canSelect ? 0 : undefined}
          onClick={canSelect ? () => onToggleSelect?.(person.id) : undefined}
          onKeyDown={
            canSelect
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onToggleSelect?.(person.id);
                  }
                }
              : undefined
          }
          aria-label={
            canSelect
              ? selected
                ? `Снять выбор: ${person.name}`
                : `Выбрать: ${person.name}`
              : undefined
          }
          aria-pressed={canSelect ? selected : undefined}
        >
          <strong className="min-w-0 wrap-break-word text-sm leading-snug">{abbreviateName(person.name)}</strong>
        </div>
      </td>
      <td className={cx(cellClass, "whitespace-nowrap")}>
        <LocationBadge value={person.location} locations={locations} />
      </td>
      {showContext ? (
        <td className={cx(cellClass, "whitespace-nowrap text-xs text-text-secondary")}>
          <span>{contextLabel ?? ""}</span>
        </td>
      ) : null}
      <td className={cellClass}>
        {canWrite && (
          <div
            className="flex min-w-max shrink-0 flex-nowrap justify-end gap-1 max-[560px]:w-full max-[560px]:justify-start max-[560px]:overflow-x-auto max-[560px]:overscroll-x-contain max-[560px]:touch-pan-x max-[560px]:pb-0.5"
            onClick={(event) => event.stopPropagation()}
          >
            {quick.map((location) => (
              <button
                key={location.id}
                type="button"
                className={cx(
                  actionButtonClass,
                  person.location === location.key && toneClasses(location.colorToken).text,
                  person.location === location.key && toneClasses(location.colorToken).border,
                  person.location === location.key && "shadow-[inset_0_0_0_1px_currentColor]",
                  pending && "cursor-wait opacity-60",
                )}
                aria-pressed={person.location === location.key}
                disabled={pending || person.location === location.key}
                onClick={() => onLocation(person, location.key)}
                aria-label={`Перевести ${person.name} в ${location.label}`}
                title={location.label}
              >
                {location.quickCode}
              </button>
            ))}
            <button
              className={actionButtonClass}
              type="button"
              onClick={() => onMore(person.id)}
              aria-label={`Выбрать место для ${person.name}`}
              disabled={!canWrite}
            >
              <MapPinIcon size={16} weight="bold" aria-hidden="true" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
});

export const Avatar = memo(function Avatar({ person }: { person: Person }) {
  return (
    <span className="grid h-10.5 w-10.5 shrink-0 place-items-center rounded-[10px] border border-line bg-bg-raised font-extrabold text-text-primary" aria-hidden="true">
      {getInitials(person.name)}
    </span>
  );
});

export const LocationBadge = memo(function LocationBadge({
  value,
  locations,
}: {
  value: string;
  locations: LocationOption[];
}) {
  const token = locationToken(value, locations);
  return (
    <span className={cx("inline-flex min-h-6 max-w-32 items-center gap-1 rounded-full border px-1.5 text-[11px] leading-none text-text-primary", toneClasses(token).border, toneClasses(token).soft)}>
      <i className={cx("h-1.5 w-1.5 shrink-0 rounded-full", toneClasses(token).bg)} />{" "}
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{locationLabel(value, locations)}</span>
    </span>
  );
});

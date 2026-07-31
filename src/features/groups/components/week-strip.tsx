"use client";

import type { DutyGroupSnapshot } from "../types";
import { formatDateLabel, formatDayLabel } from "../utils";

export function WeekStrip({
  item,
  selectedDate,
  onSelect,
}: {
  item: DutyGroupSnapshot;
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div
      className="min-w-0 overflow-x-auto rounded-xl border border-line bg-bg-panel/45"
      aria-label="План на неделю"
    >
      <div className="grid min-w-[560px] grid-cols-7 sm:min-w-0 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {item.week.map((day) => (
          <button
            key={day.date}
            type="button"
            className={`relative grid min-w-0 gap-0.5 border-0 border-r border-line p-2.5 text-left text-text-primary transition-[background,color] duration-200 last:border-r-0 hover:bg-[oklch(100%_0_0/0.065)] focus-visible:z-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan cursor-pointer ${selectedDate === day.date ? "bg-accent-soft" : "bg-transparent"} ${!day.isActive ? "bg-[oklch(100%_0_0/0.025)] opacity-[0.72]" : ""}`}
            onClick={() => onSelect(day.date)}
            aria-pressed={selectedDate === day.date}
            aria-label={`${formatDayLabel(day.dayOfWeek)}, ${formatDateLabel(day.date)}${day.isActive ? "" : ", день выключен"}`}
          >
            <span className="text-[11px] font-bold text-text-muted">
              {formatDayLabel(day.dayOfWeek)}
            </span>
            <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px]">
              {formatDateLabel(day.date)}
            </strong>
            <small className="text-[11px] font-bold text-text-muted">
              {day.isActive
                ? `${day.assignments.length}/${item.rule.peoplePerDay}`
                : "Выкл."}
            </small>
            {day.conflictsCount > 0 && (
              <em className="absolute right-1.5 top-1.5 min-w-4.5 rounded-full bg-amber text-center font-mono text-[10px] font-black not-italic text-[oklch(15%_0.035_286)]">
                {day.conflictsCount}
              </em>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}


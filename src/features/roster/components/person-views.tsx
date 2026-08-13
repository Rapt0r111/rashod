import { memo, type ReactNode } from "react";
import { MapPinIcon } from "@phosphor-icons/react";
import type { LocationOption, Person } from "../types";
import { abbreviateName, conscriptionLabel, cx, locationLabel, locationToken } from "../utils";

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

export function RosterTable({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-[10px] border border-line">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line bg-bg-raised text-xs font-semibold text-text-muted">
            <th className="px-3 py-2.5 font-semibold">Звание</th>
            <th className="px-3 py-2.5 font-semibold">Фамилия</th>
            <th className="px-3 py-2.5 font-semibold">Место</th>
            <th className="px-3 py-2.5 font-semibold">Взвод</th>
            <th className="px-3 py-2.5 font-semibold">Назначить</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
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
      <td className="px-3 py-2 align-middle text-xs text-text-muted">
        <span className="max-w-full wrap-anywhere whitespace-normal">{person.rank}</span>
      </td>
      <td className="px-3 py-2 align-middle">
        <div
          className={cx(
            "min-w-0 rounded-[10px] py-0.5",
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
          <strong className="max-w-full wrap-anywhere whitespace-normal">{abbreviateName(person.name)}</strong>
          {person.conscriptionNumber && (
            <span className="mt-0.5 block max-w-full wrap-anywhere whitespace-normal text-xs text-text-muted">
              {conscriptionLabel(person.conscriptionNumber)}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 align-middle">
        <LocationBadge value={person.location} locations={locations} />
      </td>
      <td className="px-3 py-2 align-middle text-xs text-text-secondary">
        <span className="max-w-full wrap-anywhere whitespace-normal">{contextLabel ?? ""}</span>
      </td>
      <td className="px-3 py-2 align-middle">
        {canWrite && (
          <div
            className="flex min-w-0 shrink-0 justify-end gap-1.5 max-[560px]:w-full max-[560px]:justify-start max-[560px]:overflow-x-auto max-[560px]:overscroll-x-contain max-[560px]:touch-pan-x max-[560px]:pb-0.5"
            onClick={(event) => event.stopPropagation()}
          >
            {quick.map((location) => (
              <button
                key={location.id}
                type="button"
                className={cx(
                  "grid h-11 w-11 min-h-11 min-w-11 shrink-0 place-items-center rounded-[11px] border border-line bg-white/[0.035] font-extrabold text-text-secondary transition duration-200 active:translate-y-px",
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
              className="grid h-11 w-11 min-h-11 min-w-11 shrink-0 place-items-center rounded-[11px] border border-line bg-white/[0.035] font-extrabold text-text-secondary transition duration-200 active:translate-y-px"
              type="button"
              onClick={() => onMore(person.id)}
              aria-label={`Выбрать место для ${person.name}`}
              disabled={!canWrite}
            >
              <MapPinIcon size={19} weight="bold" aria-hidden="true" />
            </button>
          </div>
        )}
      </td>
    </tr>
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
    <span className={cx("inline-flex min-h-8 max-w-42.5 items-center gap-1.75 rounded-full border px-2.5 text-xs text-text-primary", toneClasses(token).border, toneClasses(token).soft)}>
      <i className={cx("h-2 w-2 shrink-0 rounded-full", toneClasses(token).bg)} />{" "}
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{locationLabel(value, locations)}</span>
    </span>
  );
});

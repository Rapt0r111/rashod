import { memo } from "react";
import { MapPinIcon } from "@phosphor-icons/react";
import type { LocationOption, Person } from "../types";
import { abbreviateName, conscriptionLabel, cx, getInitials, locationLabel, locationToken } from "../utils";

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

export const RosterRow = memo(function RosterRow({
  person,
  locations,
  flash,
  pending,
  contextLabel,
  canWrite = true,
  onLocation,
  onMore,
}: {
  person: Person;
  locations: LocationOption[];
  flash: boolean;
  pending?: boolean;
  contextLabel?: string;
  canWrite?: boolean;
  onLocation: (person: Person, to: string) => void;
  onMore: (personId: string) => void;
}) {
  const quick = locations.filter((location) => location.isQuick);
  return (
    <article className={cx("grid min-h-17 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 overflow-hidden rounded-[15px] border border-line bg-bg-panel p-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.035)] max-[520px]:gap-2 max-[560px]:grid-cols-1", flash && "border-accent-line! bg-[color-mix(in_oklch,var(--accent)_13%,transparent)]!")} aria-busy={pending || undefined}>
      <div className="flex min-w-0 items-center gap-2.5 max-[520px]:gap-2">
        <Avatar person={person} />
        <div className="grid min-w-0 flex-1 gap-0.75 overflow-hidden">
        <strong className="max-w-full wrap-anywhere whitespace-normal">{abbreviateName(person.name)}</strong>
        <span className="max-w-full wrap-anywhere whitespace-normal text-xs text-text-muted">{person.rank}</span>
        {person.conscriptionNumber && <span className="max-w-full wrap-anywhere whitespace-normal text-xs text-text-muted">{conscriptionLabel(person.conscriptionNumber)}</span>}
        {contextLabel && <span className="max-w-full wrap-anywhere whitespace-normal text-xs text-text-muted">{contextLabel}</span>}
        </div>
        <LocationBadge value={person.location} locations={locations} />
      </div>
      {canWrite && (
        <div className="flex min-w-0 shrink-0 justify-end gap-1.5 max-[560px]:w-full max-[560px]:justify-start max-[560px]:overflow-x-auto max-[560px]:overscroll-x-contain max-[560px]:touch-pan-x max-[560px]:pb-0.5">
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
            disabled={pending}
          >
            <MapPinIcon size={19} weight="bold" aria-hidden="true" />
          </button>
        </div>
      )}
    </article>
  );
});

export const PersonCard = memo(function PersonCard({
  person,
  locations,
  flash,
  canWrite = true,
  onClick,
}: {
  person: Person;
  locations: LocationOption[];
  flash: boolean;
  canWrite?: boolean;
  onClick: (personId: string) => void;
}) {
  return (
    <button
      type="button"
      className={cx("grid min-h-34.5 gap-4 rounded-2xl border border-line bg-bg-panel p-3.5 text-left text-text-primary transition duration-200 active:translate-y-px disabled:cursor-default", flash && "border-accent-line! bg-[color-mix(in_oklch,var(--accent)_13%,transparent)]!")}
      onClick={() => canWrite && onClick(person.id)}
      disabled={!canWrite}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar person={person} />
        <span className="grid min-w-0 gap-0.75 overflow-hidden">
          <strong className="max-w-full wrap-anywhere whitespace-normal">{abbreviateName(person.name)}</strong>
          <em className="max-w-full wrap-anywhere whitespace-normal text-xs not-italic text-text-muted">{person.rank}</em>
          {person.conscriptionNumber && <em className="max-w-full wrap-anywhere whitespace-normal text-xs not-italic text-text-muted">{conscriptionLabel(person.conscriptionNumber)}</em>}
        </span>
      </span>
      <LocationBadge value={person.location} locations={locations} wide />
    </button>
  );
});

export const Avatar = memo(function Avatar({ person }: { person: Person }) {
  return (
    <span className="grid h-10.5 w-10.5 shrink-0 place-items-center rounded-[13px] border border-line-strong bg-[linear-gradient(135deg,rgb(255_255_255/0.1),rgb(255_255_255/0.035))] font-extrabold text-text-primary" aria-hidden="true">
      {getInitials(person.name)}
    </span>
  );
});

export const LocationBadge = memo(function LocationBadge({
  value,
  locations,
  wide,
}: {
  value: string;
  locations: LocationOption[];
  wide?: boolean;
}) {
  const token = locationToken(value, locations);
  return (
    <span className={cx("inline-flex min-h-8 max-w-42.5 items-center gap-1.75 rounded-full border px-2.5 text-xs text-text-primary", wide && "w-full max-w-none justify-center", toneClasses(token).border, toneClasses(token).soft)}>
      <i className={cx("h-2 w-2 shrink-0 rounded-full", toneClasses(token).bg)} />{" "}
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{locationLabel(value, locations)}</span>
    </span>
  );
});

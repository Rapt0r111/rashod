import type { LocationOption, Person, Platoon } from "./types";
import { filterListItems, normalizeListText } from "@/components/list-utils";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function normalize(value: string) {
  return normalizeListText(value);
}

export function locationLabel(value: string, locations: LocationOption[]) {
  return locations.find((location) => location.key === value)?.label ?? value;
}

export function locationToken(value: string, locations: LocationOption[]) {
  return locations.find((location) => location.key === value)?.colorToken ?? "neutral";
}

export function conscriptionLabel(value: string | null | undefined) {
  return value ? `Призыв №${value}` : "";
}

export function conscriptionOptions(people: Person[]) {
  const counts = new Map<string, number>();
  for (const person of people) {
    if (person.conscriptionNumber) counts.set(person.conscriptionNumber, (counts.get(person.conscriptionNumber) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "ru-RU", { numeric: true }))
    .map(([key, count]) => ({ key, label: conscriptionLabel(key), count }));
}

export function getInitials(name: string) {
  const [surname, initials] = name.split(" ");
  const second = initials?.replaceAll(".", "").slice(0, 1) ?? "";
  return `${surname?.slice(0, 1) ?? "Л"}${second}`.toLocaleUpperCase("ru-RU");
}

export function abbreviateName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return name;
  const [surname, first, patronymic] = parts;
  const initials = [first, patronymic]
    .filter(Boolean)
    .map((part) => {
      const compact = part.replace(/\./g, "");
      if (!compact) return "";

      const letters =
        part.includes(".") && compact.length <= 3
          ? Array.from(compact)
          : [compact.charAt(0)];

      return letters.map((letter) => `${letter}.`).join("");
    })
    .join("");
  return initials ? `${surname} ${initials}` : surname;
}

export function bySort<T extends { sortOrder: number; label?: string }>(items: T[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || (a.label ?? "").localeCompare(b.label ?? "", "ru"));
}

export function filterPeople(people: Person[], query: string) {
  return filterListItems(people, query, (person) => `${person.rank} ${person.name} ${person.conscriptionNumber ?? ""}`);
}

export type RosterFilterState = {
  locationFilter: string | null;
  locationFilterKeys: string[] | null;
  conscriptionFilter: string | null;
  conscriptionFilterKeys: string[] | null;
  platoonFilter: string | null;
  platoonFilterKeys: string[] | null;
};

export function selectedFilterKeys(keys: string[] | null, active: string | null) {
  return keys ?? (active ? [active] : []);
}

export function filterPeopleByRosterFilters(
  people: Person[],
  filters: RosterFilterState,
) {
  const selectedPlatoonKeys = selectedFilterKeys(
    filters.platoonFilterKeys,
    filters.platoonFilter,
  );
  const selectedLocationKeys = selectedFilterKeys(
    filters.locationFilterKeys,
    filters.locationFilter,
  );
  const selectedConscriptionKeys = selectedFilterKeys(
    filters.conscriptionFilterKeys,
    filters.conscriptionFilter,
  );

  return people.filter(
    (person) =>
      (!selectedPlatoonKeys.length ||
        selectedPlatoonKeys.includes(person.platoonId)) &&
      (!selectedLocationKeys.length ||
        selectedLocationKeys.includes(person.location)) &&
      (!selectedConscriptionKeys.length ||
        (person.conscriptionNumber !== null &&
          selectedConscriptionKeys.includes(person.conscriptionNumber))),
  );
}

export function peopleForPlatoon(people: Person[], platoonId: string) {
  return people.filter((person) => person.platoonId === platoonId);
}

/** @deprecated Prefer countPresent with presentLocationKeys(locations). */
export function countInRota(people: Person[]) {
  return countPresent(people, ["rota"]);
}

/** Count people whose location is in the present set (default: rota). */
export function countPresent(
  people: Person[],
  presentKeys: readonly string[] = ["rota"],
) {
  const keys = new Set(presentKeys);
  return people.filter((person) => keys.has(person.location)).length;
}

/** Compact «Рота +3 · Наряд −2» delta for batch toasts. */
export function formatLocationDeltas(
  changes: Array<{ from: string; to: string }>,
  locations: LocationOption[],
) {
  if (!changes.length) return "";
  const delta = new Map<string, number>();
  for (const change of changes) {
    delta.set(change.from, (delta.get(change.from) ?? 0) - 1);
    delta.set(change.to, (delta.get(change.to) ?? 0) + 1);
  }
  return [...delta.entries()]
    .filter(([, count]) => count !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || a[0].localeCompare(b[0], "ru"))
    .map(([key, count]) => {
      const label = locationLabel(key, locations);
      return `${label} ${count > 0 ? `+${count}` : String(count)}`;
    })
    .join(" · ");
}

export function formatDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", weekday: "long" }).format(date);
}

export function formatClock(date = new Date()) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function relativeTime(ts: number, now = Date.now()) {
  const diff = Math.max(0, now - ts);
  const minute = 60_000;
  const hour = 60 * minute;
  if (diff < minute) return "только что";
  if (diff < hour) return `${Math.floor(diff / minute)} мин назад`;
  if (diff < 24 * hour) return `${Math.floor(diff / hour)} ч назад`;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
}

export function platoonLabel(platoonId: string, platoons: Platoon[]) {
  return platoons.find((platoon) => platoon.id === platoonId)?.label ?? platoonId;
}

import type { LocationGroup, LocationOption, Person, Platoon } from "./types";
import { locationLabel, locationToken } from "./utils";

/** Keys that count as "налицо / в расположении". Default: only rota. */
export const DEFAULT_PRESENT_LOCATION_KEYS = ["rota"] as const;

/** Resolve present keys from the location directory. Empty means nothing counts as present. */
export function presentLocationKeys(
  locations: LocationOption[],
): readonly string[] {
  return locations
    .filter((location) => location.countsAsPresent)
    .map((location) => location.key);
}

export type RosterBalance = {
  total: number;
  present: number;
  away: number;
  presentPct: number;
};

export function rosterBalance(
  people: Person[],
  presentKeys: readonly string[] = DEFAULT_PRESENT_LOCATION_KEYS,
): RosterBalance {
  const presentSet = new Set(presentKeys);
  let present = 0;
  for (const person of people) {
    if (presentSet.has(person.location)) present += 1;
  }
  const total = people.length;
  return {
    total,
    present,
    away: total - present,
    presentPct: total === 0 ? 0 : Math.round((present / total) * 100),
  };
}

export type PlatoonLocationMatrixRow = {
  platoon: Platoon;
  total: number;
  byLocation: Record<string, number>;
  present: number;
};

export type PlatoonLocationMatrix = {
  locationKeys: string[];
  rows: PlatoonLocationMatrixRow[];
  columnTotals: Record<string, number>;
  grandTotal: number;
};

/** Platoon × location counts for drill-down matrix. Empty locations omitted unless in known list. */
export function platoonLocationMatrix(
  people: Person[],
  platoons: Platoon[],
  locations: LocationOption[],
  presentKeys: readonly string[] = DEFAULT_PRESENT_LOCATION_KEYS,
): PlatoonLocationMatrix {
  const knownKeys = locations.map((location) => location.key);
  const usedKeys = new Set<string>();
  const byPlatoon = new Map<string, Map<string, number>>();

  for (const platoon of platoons) {
    byPlatoon.set(platoon.id, new Map());
  }

  for (const person of people) {
    usedKeys.add(person.location);
    const map = byPlatoon.get(person.platoonId) ?? new Map<string, number>();
    map.set(person.location, (map.get(person.location) ?? 0) + 1);
    byPlatoon.set(person.platoonId, map);
  }

  const locationKeys = [
    ...knownKeys.filter((key) => usedKeys.has(key)),
    ...[...usedKeys].filter((key) => !knownKeys.includes(key)).sort((a, b) => a.localeCompare(b, "ru")),
  ];

  const presentSet = new Set(presentKeys);
  const columnTotals: Record<string, number> = Object.fromEntries(locationKeys.map((key) => [key, 0]));
  let grandTotal = 0;

  const rows: PlatoonLocationMatrixRow[] = platoons.map((platoon) => {
    const counts = byPlatoon.get(platoon.id) ?? new Map();
    const byLocation: Record<string, number> = {};
    let total = 0;
    let present = 0;
    for (const key of locationKeys) {
      const count = counts.get(key) ?? 0;
      byLocation[key] = count;
      columnTotals[key] = (columnTotals[key] ?? 0) + count;
      total += count;
      if (presentSet.has(key)) present += count;
    }
    for (const [key, count] of counts) {
      if (!locationKeys.includes(key)) {
        total += count;
        if (presentSet.has(key)) present += count;
      }
    }
    grandTotal += total;
    return { platoon, total, byLocation, present };
  }).filter((row) => row.total > 0);

  return { locationKeys, rows, columnTotals, grandTotal };
}

export function locationsAndCustom(people: Person[], locations: LocationOption[]) {
  const map = new Map<
    string,
    { key: string; label: string; token: string; count: number }
  >();
  for (const person of people) {
    const existing = map.get(person.location);
    if (existing) existing.count += 1;
    else
      map.set(person.location, {
        key: person.location,
        label: locationLabel(person.location, locations),
        token: locationToken(person.location, locations),
        count: 1,
      });
  }
  return Array.from(map.values()).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"),
  );
}

export type OverviewLocationMetric = {
  key: string;
  locationKeys: string[];
  label: string;
  token: string;
  count: number;
  sortOrder: number;
  kind: "group" | "location" | "custom";
  members?: Array<{
    key: string;
    label: string;
    token: string;
    count: number;
  }>;
};

export function overviewLocationMetrics(
  people: Person[],
  locations: LocationOption[],
  groups: LocationGroup[],
): OverviewLocationMetric[] {
  const counts = new Map<string, number>();
  for (const person of people) counts.set(person.location, (counts.get(person.location) ?? 0) + 1);

  const knownKeys = new Set(locations.map((location) => location.key));
  const enabledGroups = groups
    .filter((group) => group.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "ru"));
  const ownerByLocation = new Map<string, string>();
  for (const group of enabledGroups) {
    for (const locationKey of group.locationKeys) {
      if (!ownerByLocation.has(locationKey)) ownerByLocation.set(locationKey, group.id);
    }
  }

  const locationMetrics: OverviewLocationMetric[] = locations
    .filter((location) => !ownerByLocation.has(location.key))
    .map((location) => ({
      key: `location:${location.key}`,
      locationKeys: [location.key],
      label: location.label,
      token: location.colorToken,
      count: counts.get(location.key) ?? 0,
      sortOrder: location.sortOrder,
      kind: "location",
    }));

  const customMetrics: OverviewLocationMetric[] = Array.from(counts.keys())
    .filter((key) => !knownKeys.has(key) && !ownerByLocation.has(key))
    .map((key, index) => ({
      key: `custom:${key}`,
      locationKeys: [key],
      label: key,
      token: "neutral",
      count: counts.get(key) ?? 0,
      sortOrder: Number.MAX_SAFE_INTEGER - 1_000 + index,
      kind: "custom",
    }));

  const groupMetrics: OverviewLocationMetric[] = enabledGroups.map((group) => {
    const members = group.locationKeys
      .filter((key) => ownerByLocation.get(key) === group.id)
      .map((key) => ({
        key,
        label: locationLabel(key, locations),
        token: locationToken(key, locations),
        count: counts.get(key) ?? 0,
      }));
    return {
      key: `group:${group.id}`,
      locationKeys: members.map((member) => member.key),
      label: group.label,
      token: group.colorToken,
      count: members.reduce((sum, member) => sum + member.count, 0),
      sortOrder: group.sortOrder,
      kind: "group" as const,
      members,
    };
  });

  return [...groupMetrics, ...locationMetrics, ...customMetrics].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "ru"),
  );
}

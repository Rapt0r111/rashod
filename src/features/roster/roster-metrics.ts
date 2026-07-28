import type { LocationGroup, LocationOption, Person } from "./types";
import { locationLabel, locationToken } from "./utils";

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

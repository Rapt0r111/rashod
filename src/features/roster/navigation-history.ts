const ROSTER_NAVIGATION_KEY = "__rashodRosterNavigation";

export function getRosterHistorySection(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const navigation = (value as Record<string, unknown>)[ROSTER_NAVIGATION_KEY];
  if (!navigation || typeof navigation !== "object") return null;
  const section = (navigation as Record<string, unknown>).section;
  return typeof section === "string" && section.length > 0 ? section : null;
}

export function setRosterHistorySection(value: unknown, section: string) {
  const current = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  return {
    ...current,
    [ROSTER_NAVIGATION_KEY]: { section },
  };
}


import type { Person } from "../roster/types";
import type {
  GroupAssignment,
  GroupAssignmentQuota,
  GroupExclusion,
  GroupOverlapPolicy,
  GroupPriorityMode,
  GroupRule,
} from "./types";

export function normalizeOverlapPolicy(value: unknown): GroupOverlapPolicy {
  return value === "manual" ? "manual" : "exclusive";
}

export function classifyOverlap(
  ownPolicy: GroupOverlapPolicy,
  otherPolicy: GroupOverlapPolicy,
  otherSource: "auto" | "manual",
): "blocking" | "allowed" {
  return ownPolicy === "manual" && otherPolicy === "manual" && otherSource === "manual"
    ? "allowed"
    : "blocking";
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateKeyPlus(start: Date, offset: number): string {
  const date = new Date(start);
  date.setDate(date.getDate() + offset);
  return localDateKey(date);
}

export function dayOfWeekFromKey(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

export function weekDates(start = new Date(), days = 7): string[] {
  return Array.from({ length: days }, (_, index) => dateKeyPlus(start, index));
}

export function parseJsonArray<T>(value: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function isExcludedOnDate(exclusion: Pick<GroupExclusion, "dayOfWeek">, dateKey: string): boolean {
  return exclusion.dayOfWeek === null || exclusion.dayOfWeek === dayOfWeekFromKey(dateKey);
}

export function filterCandidates(
  people: Person[],
  rule: Pick<GroupRule, "enabledPlatoons">,
  exclusions: Pick<GroupExclusion, "personId" | "dayOfWeek">[],
  dateKey: string,
): Person[] {
  const excludedIds = new Set(
    exclusions.filter((item) => isExcludedOnDate(item, dateKey)).map((item) => item.personId),
  );
  return people.filter((person) => {
    const platoonAllowed = rule.enabledPlatoons.length === 0 || rule.enabledPlatoons.includes(person.platoonId);
    return platoonAllowed && !excludedIds.has(person.id);
  });
}

export function findStaleAutomaticAssignmentIds(
  assignments: Pick<GroupAssignment, "id" | "personId" | "source">[],
  eligiblePersonIds: ReadonlySet<string>,
): string[] {
  return assignments
    .filter(
      (assignment) =>
        assignment.source === "auto" &&
        !eligiblePersonIds.has(assignment.personId),
    )
    .map((assignment) => assignment.id);
}

export function findExcessAutomaticAssignmentIds(
  assignments: Pick<GroupAssignment, "id" | "source">[],
  maxAssignments: number,
): string[] {
  const manualCount = assignments.filter((assignment) => assignment.source === "manual").length;
  const automatic = assignments.filter((assignment) => assignment.source === "auto");
  const keepAutomatic = Math.max(0, maxAssignments - manualCount);
  return automatic.slice(keepAutomatic).map((assignment) => assignment.id);
}

export function normalizePriorityMode(value: unknown): GroupPriorityMode {
  return value === "random" ? "random" : "oldest";
}

export function normalizeAssignmentQuotas(value: unknown): GroupAssignmentQuota[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const quotas: GroupAssignmentQuota[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const source = item as { platoonId?: unknown; count?: unknown };
    const platoonId = typeof source.platoonId === "string" ? source.platoonId.trim() : "";
    const count = typeof source.count === "number" ? source.count : Number(source.count);
    if (!platoonId || !Number.isInteger(count) || count < 1 || count > 40 || seen.has(platoonId)) continue;
    seen.add(platoonId);
    quotas.push({ platoonId, count });
  }
  return quotas;
}

export function quotaTotal(quotas: readonly GroupAssignmentQuota[]): number {
  return quotas.reduce((total, quota) => total + quota.count, 0);
}

/** When quotas active — enabledPlatoons from quota units. Else keep explicit filter (incl. empty = all units). */
export function resolveRuleEnabledPlatoons(
  assignmentQuotas: readonly GroupAssignmentQuota[],
  enabledPlatoons: readonly string[] | undefined,
  currentEnabledPlatoons: readonly string[],
): string[] {
  if (assignmentQuotas.length > 0) {
    return assignmentQuotas.map((quota) => quota.platoonId);
  }
  const source = enabledPlatoons ?? currentEnabledPlatoons;
  return [...new Set(source.map((id) => id.trim()).filter(Boolean))];
}

export function filterPeopleByAssignmentQuotas(
  people: Person[],
  quotas: readonly GroupAssignmentQuota[],
): Person[] {
  if (quotas.length === 0) return people;
  const platoonIds = new Set(quotas.map((quota) => quota.platoonId));
  return people.filter((person) => platoonIds.has(person.platoonId));
}

/** Pool for one quota row. Keep same-date conflicts in pool — pickRotationCandidates falls back only if short. */
export function selectQuotaRotationPool(
  candidates: Person[],
  platoonId: string,
  assignedPersonIds: ReadonlySet<string>,
): Person[] {
  return candidates.filter(
    (person) => person.platoonId === platoonId && !assignedPersonIds.has(person.id),
  );
}

/** Platoon filter for eligibility / candidate lists when quotas may be active. */
export function rulePlatoonFilter(
  rule: Pick<GroupRule, "enabledPlatoons" | "assignmentQuotas">,
): string[] {
  return resolveRuleEnabledPlatoons(rule.assignmentQuotas, rule.enabledPlatoons, rule.enabledPlatoons);
}

export function quotaAssignmentCounts(
  quotas: readonly GroupAssignmentQuota[],
  assignments: Pick<GroupAssignment, "personId">[],
  peopleById: ReadonlyMap<string, Pick<Person, "platoonId">>,
): number[] {
  const claimed = new Set<string>();
  return quotas.map((quota) => {
    let count = 0;
    for (const assignment of assignments) {
      if (claimed.has(assignment.personId)) continue;
      if (peopleById.get(assignment.personId)?.platoonId !== quota.platoonId) continue;
      claimed.add(assignment.personId);
      count += 1;
    }
    return count;
  });
}
function shufflePeople(candidates: Person[], random: () => number): Person[] {
  const shuffled = [...candidates];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function pickRandomAssignment(
  candidates: Person[],
  count: number,
  random: () => number = Math.random,
): Person[] {
  return shufflePeople(candidates, random).slice(0, Math.max(0, count));
}

export function pickByOldestAssignment(
  candidates: Person[],
  assignments: Pick<GroupAssignment, "personId" | "assignedDate">[],
  count: number,
): Person[] {
  const lastByPerson = new Map<string, string>();
  for (const assignment of assignments) {
    const current = lastByPerson.get(assignment.personId);
    if (!current || assignment.assignedDate > current) {
      lastByPerson.set(assignment.personId, assignment.assignedDate);
    }
  }

  return [...candidates]
    .map((person) => ({ person, last: lastByPerson.get(person.id) ?? "0000-00-00" }))
    .sort((a, b) => {
      const byLast = a.last.localeCompare(b.last);
      if (byLast !== 0) return byLast;
      return a.person.sortOrder - b.person.sortOrder || a.person.name.localeCompare(b.person.name);
    })
    .slice(0, Math.max(0, count))
    .map((item) => item.person);
}

export function pickRotationCandidates(
  candidates: Person[],
  assignments: Pick<GroupAssignment, "personId" | "assignedDate">[],
  count: number,
  blockedPersonIds: ReadonlySet<string> = new Set(),
  priorityMode: GroupPriorityMode = "oldest",
  random: () => number = Math.random,
): Person[] {
  const picker = (items: Person[], needed: number) => priorityMode === "random"
    ? pickRandomAssignment(items, needed, random)
    : pickByOldestAssignment(items, assignments, needed);
  const safeCandidates = candidates.filter((person) => !blockedPersonIds.has(person.id));
  const picked = picker(safeCandidates, count);
  if (picked.length >= count) return picked;

  const pickedIds = new Set(picked.map((person) => person.id));
  const fallbackCandidates = candidates.filter((person) => !pickedIds.has(person.id));
  return [
    ...picked,
    ...picker(fallbackCandidates, count - picked.length),
  ];
}

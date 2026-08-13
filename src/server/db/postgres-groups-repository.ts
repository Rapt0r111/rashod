import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import type { Person, Platoon } from "@/features/roster/types";
import type {
  ConflictState,
  DutyGroup,
  DutyGroupSnapshot,
  GroupAssignment,
  GroupAssignmentRangeResult,
  GroupAssignmentRangeSkip,
  GroupConflict,
  GroupCreateInput,
  GroupDaySnapshot,
  GroupExclusion,
  GroupRule,
  GroupsSnapshot,
  GroupTemplate,
  GroupUpdateInput,
  RuleUpdateInput,
} from "@/features/groups/types";
import {
  dayOfWeekFromKey,
  filterCandidates,
  findExcessAutomaticAssignmentIds,
  findStaleAutomaticAssignmentIds,
  filterPeopleByAssignmentQuotas,
  localDateKey,
  normalizeAssignmentQuotas,
  normalizeOverlapPolicy,
  classifyOverlap,
  conflictStateFromLive,
  quotaAssignmentCounts,
  quotaTotal,
  normalizePriorityMode,
  pickRotationCandidates,
  resolveRuleEnabledPlatoons,
  rulePlatoonFilter,
  selectQuotaRotationPool,
  weekDates,
} from "@/features/groups/logic";
import { scheduleDateRange } from "@/features/schedule/logic";
import { inPostgresTransaction, pg } from "./postgres";

type DbPerson = Omit<Person, "createdAt" | "updatedAt"> & { created_at: Date; updated_at: Date };
type DbTemplate = Omit<GroupTemplate, "createdAt" | "defaultActiveDays"> & { defaultActiveDays: unknown; created_at: Date };
type DbGroup = Omit<DutyGroup, "createdAt" | "updatedAt"> & { created_at: Date; updated_at: Date };
type DbRule = Omit<GroupRule, "enabledPlatoons" | "activeDays" | "priorityMode" | "assignmentQuotas" | "overlapPolicy"> & {
  enabledPlatoons: unknown;
  assignmentQuotas: unknown;
  activeDays: unknown;
  priorityMode: unknown;
  overlapPolicy: unknown;
};
type DbAssignment = Omit<GroupAssignment, "personName" | "personRank" | "personConscriptionNumber" | "conflicts" | "source" | "conflictState" | "createdAt"> & {
  source: string;
  conflictState: string;
  created_at: Date;
};
type DbExclusion = Omit<GroupExclusion, "personName" | "personRank" | "personConscriptionNumber" | "createdAt"> & { created_at: Date };
type SnapshotRuleRow = {
  groupId: string;
  ruleId: string | null;
  enabledPlatoons: unknown;
  assignmentQuotas: unknown;
  peoplePerDay: number | null;
  autoRotate: boolean | null;
  activeDays: unknown;
  priorityMode: unknown;
  overlapPolicy: unknown;
  defaultPeoplePerDay: number;
  defaultActiveDays: unknown;
};
type SnapshotAssignmentRow = DbAssignment & {
  personName: string | null;
  personRank: string | null;
  personConscriptionNumber: string | null;
};
type SnapshotExclusionRow = DbExclusion & {
  personName: string | null;
  personRank: string | null;
  personConscriptionNumber: string | null;
};
type SqlExecutor = ReturnType<typeof pg> | postgres.TransactionSql;
type RotationAssignment = Pick<GroupAssignment, "id" | "personId" | "assignedDate" | "source">;
type RotationContext = {
  people: Person[];
  exclusionsByGroup: Map<string, GroupExclusion[]>;
  historyByGroup: Map<string, RotationAssignment[]>;
  assignedByDate: Map<string, Array<{ id: string; groupId: string; personId: string }>>;
};
export type GroupAssignmentIneligibilityReason = "excluded" | "platoon_disabled" | "inactive_day" | "group_disabled";
export function groupAssignmentIneligibility(input: { groupEnabled: boolean; activeDays: readonly number[]; dayOfWeek: number; enabledPlatoons: readonly string[]; personPlatoonId: string; excluded: boolean }): GroupAssignmentIneligibilityReason | null { if (!input.groupEnabled) return "group_disabled"; if (!input.activeDays.includes(input.dayOfWeek)) return "inactive_day"; if (input.enabledPlatoons.length > 0 && !input.enabledPlatoons.includes(input.personPlatoonId)) return "platoon_disabled"; if (input.excluded) return "excluded"; return null; }
export class GroupAssignmentIneligibleError extends Error { constructor(public readonly reason: GroupAssignmentIneligibilityReason) { super("GROUP_ASSIGNMENT_INELIGIBLE"); this.name = "GroupAssignmentIneligibleError"; } }

const ALL_ACTIVE_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Same millisecond truncation as Date.getTime() — never round .5 up via ::bigint. */
export const GROUP_UPDATED_AT_LOCK_SQL =
  "FLOOR(EXTRACT(EPOCH FROM date_trunc('milliseconds', updated_at)) * 1000)";

function unwrapJsonScalar(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

export function normalizeActiveDays(value: unknown, fallback: number[] = [...ALL_ACTIVE_DAYS]): number[] {
  const unwrapped = unwrapJsonScalar(value);
  if (!Array.isArray(unwrapped)) return [...fallback];
  const normalized = unwrapped
    .map((item) => {
      if (typeof item === "number") return item;
      if (typeof item === "string" && item.trim() !== "") return Number(item);
      return Number.NaN;
    })
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6);
  const unique = [...new Set(normalized)].sort((left, right) => left - right);
  return unique.length || unwrapped.length === 0 ? unique : [...fallback];
}

export function normalizeStringArray(value: unknown): string[] {
  const unwrapped = unwrapJsonScalar(value);
  if (!Array.isArray(unwrapped)) return [];
  return [...new Set(unwrapped.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}

function toPerson(row: DbPerson): Person {
  return { ...row, createdAt: row.created_at.getTime(), updatedAt: row.updated_at.getTime() };
}

function toTemplate(row: DbTemplate): GroupTemplate {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    colorToken: row.colorToken,
    icon: row.icon,
    defaultPeoplePerDay: row.defaultPeoplePerDay,
    defaultActiveDays: normalizeActiveDays(row.defaultActiveDays),
    sortOrder: row.sortOrder,
    isSystem: row.isSystem,
    createdAt: row.created_at.getTime(),
  };
}

function toGroup(row: DbGroup): DutyGroup {
  return {
    id: row.id,
    templateId: row.templateId,
    name: row.name,
    notes: row.notes,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    createdAt: row.created_at.getTime(),
    updatedAt: row.updated_at.getTime(),
  };
}

function toRule(row: DbRule): GroupRule {
  return {
    id: row.id,
    groupId: row.groupId,
    enabledPlatoons: normalizeStringArray(row.enabledPlatoons),
    peoplePerDay: row.peoplePerDay,
    assignmentQuotas: normalizeAssignmentQuotas(row.assignmentQuotas),
    autoRotate: row.autoRotate,
    activeDays: normalizeActiveDays(row.activeDays),
    priorityMode: normalizePriorityMode(row.priorityMode),
    overlapPolicy: normalizeOverlapPolicy(row.overlapPolicy),
  };
}

function assignmentDate(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString().slice(0, 10);
}

async function getDutyTemplates(): Promise<GroupTemplate[]> {
  const rows = await pg()<DbTemplate[]>`
    SELECT id, key, name, color_token AS "colorToken", icon,
      default_people_per_day AS "defaultPeoplePerDay", default_active_days AS "defaultActiveDays",
      sort_order AS "sortOrder", is_system AS "isSystem", created_at
    FROM group_templates ORDER BY sort_order, name
  `;
  return rows.map(toTemplate);
}

async function getDutyGroups(sql: SqlExecutor = pg()): Promise<DutyGroup[]> {
  const rows = await sql<DbGroup[]>`
    SELECT id, template_id AS "templateId", name, notes, enabled, sort_order AS "sortOrder", created_at, updated_at
    FROM duty_groups ORDER BY sort_order, name
  `;
  return rows.map(toGroup);
}

async function allPeopleSorted(sql: SqlExecutor = pg()): Promise<Person[]> {
  const rows = await sql<DbPerson[]>`
    SELECT id, platoon_id AS "platoonId", rank, name, conscription_number AS "conscriptionNumber", location, sort_order AS "sortOrder", created_at, updated_at
    FROM people ORDER BY sort_order, name
  `;
  return rows.map(toPerson);
}

async function getPlatoons(): Promise<Platoon[]> {
  return pg()<Platoon[]>`SELECT id, key, label, sort_order AS "sortOrder", is_system AS "isSystem" FROM platoons ORDER BY sort_order, label`;
}

async function getDutyRule(groupId: string, sql: SqlExecutor = pg()): Promise<GroupRule> {
  const rows = await sql<DbRule[]>`
    SELECT id, group_id AS "groupId", enabled_platoons AS "enabledPlatoons", people_per_day AS "peoplePerDay",
      assignment_quotas AS "assignmentQuotas", auto_rotate AS "autoRotate", active_days AS "activeDays", priority_mode AS "priorityMode", overlap_policy AS "overlapPolicy"
    FROM group_rules WHERE group_id = ${groupId}
  `;
  if (rows[0]) return toRule(rows[0]);

  const defaults = await sql<Array<{ defaultPeoplePerDay: number; defaultActiveDays: unknown }>>`
    SELECT gt.default_people_per_day AS "defaultPeoplePerDay", gt.default_active_days AS "defaultActiveDays"
    FROM duty_groups dg JOIN group_templates gt ON gt.id = dg.template_id
    WHERE dg.id = ${groupId}
  `;
  if (!defaults[0]) throw new Error("GROUP_NOT_FOUND");
  const rule: GroupRule = {
    id: randomUUID(),
    groupId,
    enabledPlatoons: [],
    peoplePerDay: defaults[0].defaultPeoplePerDay,
    assignmentQuotas: [],
    autoRotate: true,
    activeDays: normalizeActiveDays(defaults[0].defaultActiveDays),
    priorityMode: "oldest",
    overlapPolicy: "exclusive",
  };
  // Snapshot reads must stay side-effect free. Explicit write paths create a
  // missing rule before updating it; a legacy missing rule can still render
  // from template defaults without mutating the database during GET.
  return rule;
}

async function getDutyExclusions(groupId: string, sql: SqlExecutor = pg()): Promise<GroupExclusion[]> {
  const rows = await sql<Array<DbExclusion & { personName: string | null; personRank: string | null; personConscriptionNumber: string | null }>>`
    SELECT ge.id, ge.group_id AS "groupId", ge.person_id AS "personId", ge.day_of_week AS "dayOfWeek", ge.reason, ge.created_at,
      p.name AS "personName", p.rank AS "personRank", p.conscription_number AS "personConscriptionNumber"
    FROM group_exclusions ge LEFT JOIN people p ON p.id = ge.person_id
    WHERE ge.group_id = ${groupId}
  `;
  return rows.map((row) => ({
    id: row.id, groupId: row.groupId, personId: row.personId, personName: row.personName, personRank: row.personRank, personConscriptionNumber: row.personConscriptionNumber,
    dayOfWeek: row.dayOfWeek, reason: row.reason, createdAt: row.created_at.getTime(),
  }));
}

async function conflictRows(personId: string, date: string, ownGroupId?: string, sql: SqlExecutor = pg()): Promise<GroupConflict[]> {
  const [ownGroup] = ownGroupId
    ? await sql<Array<{ overlapPolicy: unknown }>>`
        SELECT COALESCE(overlap_policy, 'exclusive') AS "overlapPolicy"
        FROM group_rules WHERE group_id = ${ownGroupId}
      `
    : [{ overlapPolicy: "exclusive" }];
  const rows = await sql<Array<{ groupId: string; groupName: string; assignedDate: string | Date; source: string; overlapPolicy: unknown }>>`
    SELECT ga.group_id AS "groupId", dg.name AS "groupName", ga.assigned_date AS "assignedDate",
      ga.source, COALESCE(gr.overlap_policy, 'exclusive') AS "overlapPolicy"
    FROM group_assignments ga JOIN duty_groups dg ON dg.id = ga.group_id
      LEFT JOIN group_rules gr ON gr.group_id = ga.group_id
    WHERE ga.person_id = ${personId} AND ga.assigned_date = ${date}::date
      AND (${ownGroupId ?? null}::text IS NULL OR ga.group_id <> ${ownGroupId ?? null}::text)
  `;
  return rows.map((row) => ({
    groupId: row.groupId,
    groupName: row.groupName,
    date: assignmentDate(row.assignedDate),
    kind: classifyOverlap(
      normalizeOverlapPolicy(ownGroup?.overlapPolicy),
      normalizeOverlapPolicy(row.overlapPolicy),
      row.source === "manual" ? "manual" : "auto",
    ),
  }));
}

async function enrichDutyAssignments(rows: DbAssignment[], sql: SqlExecutor = pg()): Promise<GroupAssignment[]> {
  return Promise.all(rows.map(async (row) => {
    const [person] = await sql<Array<{ name: string; rank: string; conscriptionNumber: string | null }>>`SELECT name, rank, conscription_number AS "conscriptionNumber" FROM people WHERE id = ${row.personId}`;
    const conflicts = await conflictRows(row.personId, assignmentDate(row.assignedDate), row.groupId, sql);
    return {
      id: row.id,
      groupId: row.groupId,
      personId: row.personId,
      personName: person?.name ?? null,
      personRank: person?.rank ?? null,
      personConscriptionNumber: person?.conscriptionNumber ?? null,
      assignedDate: assignmentDate(row.assignedDate),
      source: row.source === "manual" ? "manual" : "auto",
      conflictState: conflictStateFromLive(conflicts),
      conflicts,
      createdAt: row.created_at.getTime(),
    } satisfies GroupAssignment;
  }));
}

async function getAssignmentsForGroup(groupId: string, sql: SqlExecutor = pg()): Promise<RotationAssignment[]> {
  const rows = await sql<Array<{ id: string; personId: string; assignedDate: string | Date; source: string }>>`
    SELECT id, person_id AS "personId", assigned_date AS "assignedDate", source
    FROM group_assignments WHERE group_id = ${groupId} ORDER BY assigned_date, created_at
  `;
  return rows.map((row) => ({
    id: row.id,
    personId: row.personId,
    assignedDate: assignmentDate(row.assignedDate),
    source: row.source === "manual" ? "manual" : "auto",
  }));
}

async function getAssignmentsForGroupDate(groupId: string, date: string, sql: SqlExecutor = pg()): Promise<RotationAssignment[]> {
  const rows = await sql<Array<{ id: string; personId: string; assignedDate: string | Date; source: string }>>`
    SELECT id, person_id AS "personId", assigned_date AS "assignedDate", source
    FROM group_assignments WHERE group_id = ${groupId} AND assigned_date = ${date}::date
    ORDER BY created_at
  `;
  return rows.map((row) => ({
    id: row.id,
    personId: row.personId,
    assignedDate: assignmentDate(row.assignedDate),
    source: row.source === "manual" ? "manual" : "auto",
  }));
}

async function assignedPersonIdsOnDate(date: string, ownGroupId?: string, sql: SqlExecutor = pg()): Promise<Set<string>> {
  const rows = await sql<Array<{ personId: string }>>`
    SELECT person_id AS "personId" FROM group_assignments
    WHERE assigned_date = ${date}::date AND (${ownGroupId ?? null}::text IS NULL OR group_id <> ${ownGroupId ?? null}::text)
  `;
  return new Set(rows.map((row) => row.personId));
}

async function deleteDutyAssignments(ids: string[], sql: SqlExecutor = pg()) {
  for (const id of ids) await sql`DELETE FROM group_assignments WHERE id = ${id}`;
}

function forgetRotationAssignments(context: RotationContext | undefined, ids: ReadonlySet<string>) {
  if (!context || ids.size === 0) return;
  for (const [date, rows] of context.assignedByDate) {
    context.assignedByDate.set(date, rows.filter((row) => !ids.has(row.id)));
  }
  for (const [groupId, rows] of context.historyByGroup) {
    context.historyByGroup.set(groupId, rows.filter((row) => !ids.has(row.id)));
  }
}

function rememberRotationAssignment(
  context: RotationContext | undefined,
  assignment: RotationAssignment & { groupId: string },
) {
  if (!context) return;
  const dateRows = context.assignedByDate.get(assignment.assignedDate) ?? [];
  dateRows.push({ id: assignment.id, groupId: assignment.groupId, personId: assignment.personId });
  context.assignedByDate.set(assignment.assignedDate, dateRows);
  const history = context.historyByGroup.get(assignment.groupId) ?? [];
  history.push(assignment);
  context.historyByGroup.set(assignment.groupId, history);
}

async function writeDutyAssignment(groupId: string, personId: string, date: string, source: "auto" | "manual", conflictState: ConflictState = "clear", sql: SqlExecutor = pg()) {
  const inserted = await sql<Array<{ id: string }>>`
    INSERT INTO group_assignments (id, group_id, person_id, assigned_date, source, conflict_state)
    VALUES (${randomUUID()}, ${groupId}, ${personId}, ${date}::date, ${source}, ${conflictState})
    ON CONFLICT (group_id, person_id, assigned_date) DO NOTHING
    RETURNING id
  `;
  if (inserted[0]) return inserted[0].id;
  const existing = await sql<Array<{ id: string }>>`
    SELECT id FROM group_assignments
    WHERE group_id = ${groupId} AND person_id = ${personId} AND assigned_date = ${date}::date
  `;
  return existing[0]?.id ?? null;
}

async function lockAssignmentDay(sql: SqlExecutor, date: string, groupId: string, personId?: string) {
  await sql`SELECT pg_advisory_xact_lock(hashtext(${`group-assignment-date:${date}`}::text)::bigint)`;
  await sql`SELECT pg_advisory_xact_lock(hashtext(${`group-assignment-group-date:${groupId}:${date}`}::text)::bigint)`;
  if (personId) await sql`SELECT pg_advisory_xact_lock(hashtext(${`group-assignment-person-date:${personId}:${date}`}::text)::bigint)`;
}

async function ensureGroupAssignments(group: DutyGroup, rule: GroupRule, date: string, sql?: SqlExecutor, context?: RotationContext): Promise<void> {
  if (!sql) return inPostgresTransaction((transaction) => ensureGroupAssignments(group, rule, date, transaction));
  if (!group.enabled || !rule.activeDays.includes(dayOfWeekFromKey(date))) {
    if (!rule.autoRotate) return;
    await lockAssignmentDay(sql, date, group.id);
    const current = await getAssignmentsForGroupDate(group.id, date, sql);
    const automaticIds = current.filter((assignment) => assignment.source === "auto").map((assignment) => assignment.id);
    if (automaticIds.length) {
      await deleteDutyAssignments(automaticIds, sql);
      forgetRotationAssignments(context, new Set(automaticIds));
    }
    return;
  }
  if (!rule.autoRotate) return;
  await lockAssignmentDay(sql, date, group.id);
  const exclusions = context?.exclusionsByGroup.get(group.id) ?? await getDutyExclusions(group.id, sql);
  const people = context?.people ?? await allPeopleSorted(sql);
  // Quotas own the platoon filter via filterPeopleByAssignmentQuotas; empty enabledPlatoons = no extra filter.
  const candidateRule = rule.assignmentQuotas.length > 0 ? { ...rule, enabledPlatoons: [] } : rule;
  let candidates = filterPeopleByAssignmentQuotas(
    filterCandidates(people, candidateRule, exclusions, date),
    rule.assignmentQuotas,
  );
  if (date === localDateKey()) {
    const presentRows = await sql<Array<{ key: string }>>`
      SELECT key FROM locations WHERE counts_as_present = true
    `;
    const present = new Set(presentRows.map((row) => row.key));
    candidates = candidates.filter((person) => present.has(person.location));
  }
  const eligiblePersonIds = new Set(candidates.map((person) => person.id));
  let current = await getAssignmentsForGroupDate(group.id, date, sql);
  const quotaMode = rule.assignmentQuotas.length > 0;
  const blocked = context
    ? new Set((context.assignedByDate.get(date) ?? []).filter((assignment) => assignment.groupId !== group.id).map((assignment) => assignment.personId))
    : await assignedPersonIdsOnDate(date, group.id, sql);
  const staleAutoIds = [
    ...findStaleAutomaticAssignmentIds(current, eligiblePersonIds),
    ...(quotaMode ? [] : findExcessAutomaticAssignmentIds(current, rule.peoplePerDay)),
    ...current
      .filter((assignment) => assignment.source === "auto" && blocked.has(assignment.personId))
      .map((assignment) => assignment.id),
  ];
  const idsToDelete = [...new Set(staleAutoIds)];
  if (idsToDelete.length) {
    await deleteDutyAssignments(idsToDelete, sql);
    forgetRotationAssignments(context, new Set(idsToDelete));
    current = current.filter((assignment) => !idsToDelete.includes(assignment.id));
  }
  const history = context?.historyByGroup.get(group.id) ?? await getAssignmentsForGroup(group.id, sql);
  if (quotaMode) {
    const peopleById = new Map(people.map((person) => [person.id, person]));
    const assignedIds = new Set(current.map((assignment) => assignment.personId));
    const claimedIds = new Set<string>();
    for (const quota of rule.assignmentQuotas) {
      const matching = current.filter((assignment) =>
        !claimedIds.has(assignment.personId) && peopleById.get(assignment.personId)?.platoonId === quota.platoonId,
      );
      const manual = matching.filter((assignment) => assignment.source === "manual");
      const automatic = matching.filter((assignment) => assignment.source === "auto");
      const keepAutomatic = Math.max(0, quota.count - manual.length);
      const excessIds = automatic.slice(keepAutomatic).map((assignment) => assignment.id);
      if (excessIds.length) {
        await deleteDutyAssignments(excessIds, sql);
        current = current.filter((assignment) => !excessIds.includes(assignment.id));
        for (const assignment of automatic.slice(keepAutomatic)) assignedIds.delete(assignment.personId);
      }
      const retained = matching.filter((assignment) => !excessIds.includes(assignment.id));
      for (const assignment of retained) claimedIds.add(assignment.personId);
      const needed = Math.max(0, quota.count - retained.length);
      if (!needed) continue;
      // Do not pre-drop blocked people: conflict fallback only after free candidates exhausted.
      const available = selectQuotaRotationPool(candidates, quota.platoonId, assignedIds);
      const picked = pickRotationCandidates(available, history, needed, blocked, rule.priorityMode);
      for (const person of picked) {
        const id = await writeDutyAssignment(group.id, person.id, date, "auto", "clear", sql);
        if (id) rememberRotationAssignment(context, { id, groupId: group.id, personId: person.id, assignedDate: date, source: "auto" });
        assignedIds.add(person.id);
        claimedIds.add(person.id);
      }
    }
    return;
  }
  const remaining = Math.max(0, rule.peoplePerDay - current.length);
  if (!remaining) return;
  const availableCandidates = candidates.filter((person) => !current.some((assignment) => assignment.personId === person.id));
  const picked = pickRotationCandidates(availableCandidates, history, remaining, blocked, rule.priorityMode);
  for (const person of picked) {
    const id = await writeDutyAssignment(group.id, person.id, date, "auto", "clear", sql);
    if (id) rememberRotationAssignment(context, { id, groupId: group.id, personId: person.id, assignedDate: date, source: "auto" });
  }
}
function buildDutyGroupSnapshotFromData(
  group: DutyGroup,
  templates: GroupTemplate[],
  dates: string[],
  platoonRows: Platoon[],
  people: Person[],
  rulesByGroup: ReadonlyMap<string, GroupRule>,
  exclusionsByGroup: ReadonlyMap<string, GroupExclusion[]>,
  assignmentsByGroup: ReadonlyMap<string, GroupAssignment[]>,
): DutyGroupSnapshot {
  const template = templates.find((item) => item.id === group.templateId) ?? templates[0];
  if (!template) throw new Error("GROUP_TEMPLATE_REQUIRED");
  const rule = rulesByGroup.get(group.id);
  if (!rule) throw new Error("GROUP_RULE_REQUIRED");
  const exclusions = exclusionsByGroup.get(group.id) ?? [];
  const assignments = assignmentsByGroup.get(group.id) ?? [];
  const today = dates[0] ?? localDateKey();
  const candidateRule = rule.assignmentQuotas.length > 0 ? { ...rule, enabledPlatoons: [] } : rule;
  const candidatePeople = filterPeopleByAssignmentQuotas(
    people.filter((person) => candidateRule.enabledPlatoons.length === 0 || candidateRule.enabledPlatoons.includes(person.platoonId)),
    rule.assignmentQuotas,
  );
  const candidatesByDate = new Map(dates.map((date) => [
    date,
    filterPeopleByAssignmentQuotas(filterCandidates(people, candidateRule, exclusions, date), rule.assignmentQuotas),
  ]));
  const assignmentsByDate = new Map<string, GroupAssignment[]>();
  for (const assignment of assignments) {
    const dayAssignments = assignmentsByDate.get(assignment.assignedDate) ?? [];
    dayAssignments.push(assignment);
    assignmentsByDate.set(assignment.assignedDate, dayAssignments);
  }
  const availablePeopleByDate = Object.fromEntries(dates.map((date) => {
    const assignedIds = new Set((assignmentsByDate.get(date) ?? []).map((assignment) => assignment.personId));
    return [date, (candidatesByDate.get(date) ?? []).filter((person) => !assignedIds.has(person.id))];
  }));
  const availableToday = availablePeopleByDate[today] ?? [];
  const candidatePlatoons = rule.assignmentQuotas.length > 0
    ? platoonRows.filter((platoon) => rule.assignmentQuotas.some((quota) => quota.platoonId === platoon.id))
    : (rule.enabledPlatoons.length === 0 ? platoonRows : platoonRows.filter((platoon) => rule.enabledPlatoons.includes(platoon.id)));
  const week: GroupDaySnapshot[] = dates.map((date) => {
    const dayAssignments = assignmentsByDate.get(date) ?? [];
    const candidates = candidatesByDate.get(date) ?? [];
    return {
      date,
      dayOfWeek: dayOfWeekFromKey(date),
      isActive: group.enabled && rule.activeDays.includes(dayOfWeekFromKey(date)),
      assignments: dayAssignments,
      candidatesCount: candidates.length,
      conflictsCount: dayAssignments.filter((item) => item.conflicts.length > 0).length,
    };
  });
  const todayAssignments = assignmentsByDate.get(today) ?? [];
  return {
    group,
    template,
    rule,
    todayAssignments,
    week,
    exclusions,
    availablePeople: availableToday,
    availablePeopleByDate,
    candidatePeople,
    candidatePlatoons,
    stats: {
      assignedToday: todayAssignments.length,
      availableToday: availableToday.length,
      conflictsToday: todayAssignments.filter((item) => item.conflicts.length > 0).length,
      weekAssignments: week.reduce((sum, day) => sum + day.assignments.length, 0),
    },
  };
}

export async function getPostgresGroupsSnapshot(): Promise<GroupsSnapshot> {
  const sql = pg();
  const dates = weekDates(new Date(), 7);
  const [templates, groups, platoons, people, ruleRows, exclusionRows, assignmentRows] = await Promise.all([
    getDutyTemplates(),
    getDutyGroups(),
    getPlatoons(),
    allPeopleSorted(),
    sql<SnapshotRuleRow[]>`
      SELECT dg.id AS "groupId", gr.id AS "ruleId",
        gr.enabled_platoons AS "enabledPlatoons", gr.people_per_day AS "peoplePerDay", gr.assignment_quotas AS "assignmentQuotas",
        gr.auto_rotate AS "autoRotate", gr.active_days AS "activeDays", gr.priority_mode AS "priorityMode", gr.overlap_policy AS "overlapPolicy",
        gt.default_people_per_day AS "defaultPeoplePerDay", gt.default_active_days AS "defaultActiveDays"
      FROM duty_groups dg
      JOIN group_templates gt ON gt.id = dg.template_id
      LEFT JOIN group_rules gr ON gr.group_id = dg.id
    `,
    sql<SnapshotExclusionRow[]>`
      SELECT ge.id, ge.group_id AS "groupId", ge.person_id AS "personId", ge.day_of_week AS "dayOfWeek",
        ge.reason, ge.created_at, p.name AS "personName", p.rank AS "personRank",
        p.conscription_number AS "personConscriptionNumber"
      FROM group_exclusions ge
      LEFT JOIN people p ON p.id = ge.person_id
      ORDER BY ge.group_id, ge.created_at
    `,
    sql<SnapshotAssignmentRow[]>`
      SELECT ga.id, ga.group_id AS "groupId", ga.person_id AS "personId", ga.assigned_date AS "assignedDate",
        ga.source, ga.conflict_state AS "conflictState", ga.created_at,
        p.name AS "personName", p.rank AS "personRank", p.conscription_number AS "personConscriptionNumber"
      FROM group_assignments ga
      LEFT JOIN people p ON p.id = ga.person_id
      WHERE ga.assigned_date BETWEEN ${dates[0]}::date AND ${dates[dates.length - 1]}::date
      ORDER BY ga.group_id, ga.assigned_date, ga.created_at
    `,
  ]);
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const overlapPolicies = new Map(
    ruleRows.map((row) => [row.groupId, normalizeOverlapPolicy(row.overlapPolicy)]),
  );
  const assignmentsByPersonDate = new Map<string, SnapshotAssignmentRow[]>();
  for (const row of assignmentRows) {
    const key = `${row.personId}\u0000${assignmentDate(row.assignedDate)}`;
    const rows = assignmentsByPersonDate.get(key) ?? [];
    rows.push(row);
    assignmentsByPersonDate.set(key, rows);
  }
  const assignmentsByGroup = new Map<string, GroupAssignment[]>();
  for (const row of assignmentRows) {
    const key = `${row.personId}\u0000${assignmentDate(row.assignedDate)}`;
    const conflicts = (assignmentsByPersonDate.get(key) ?? [])
      .filter((other) => other.groupId !== row.groupId)
      .map((other) => ({
        groupId: other.groupId,
        groupName: groupNames.get(other.groupId) ?? other.groupId,
        date: assignmentDate(other.assignedDate),
        kind: classifyOverlap(
          overlapPolicies.get(row.groupId) ?? "exclusive",
          overlapPolicies.get(other.groupId) ?? "exclusive",
          other.source === "manual" ? "manual" : "auto",
        ),
      }));
    const assignment: GroupAssignment = {
      id: row.id,
      groupId: row.groupId,
      personId: row.personId,
      personName: row.personName,
      personRank: row.personRank,
      personConscriptionNumber: row.personConscriptionNumber,
      assignedDate: assignmentDate(row.assignedDate),
      source: row.source === "manual" ? "manual" : "auto",
      conflictState: conflictStateFromLive(conflicts),
      conflicts,
      createdAt: row.created_at.getTime(),
    };
    const assignments = assignmentsByGroup.get(row.groupId) ?? [];
    assignments.push(assignment);
    assignmentsByGroup.set(row.groupId, assignments);
  }
  const rulesByGroup = new Map<string, GroupRule>();
  for (const row of ruleRows) {
    rulesByGroup.set(row.groupId, row.ruleId
      ? toRule({
          id: row.ruleId,
          groupId: row.groupId,
          enabledPlatoons: row.enabledPlatoons,
          peoplePerDay: row.peoplePerDay ?? row.defaultPeoplePerDay,
          assignmentQuotas: row.assignmentQuotas,
          autoRotate: row.autoRotate ?? true,
          activeDays: row.activeDays,
          priorityMode: row.priorityMode,
          overlapPolicy: row.overlapPolicy,
        })
      : {
          id: randomUUID(),
          groupId: row.groupId,
          enabledPlatoons: [],
          peoplePerDay: row.defaultPeoplePerDay,
          assignmentQuotas: [],
          autoRotate: true,
          activeDays: normalizeActiveDays(row.defaultActiveDays),
          priorityMode: "oldest",
          overlapPolicy: "exclusive",
        });
  }
  const exclusionsByGroup = new Map<string, GroupExclusion[]>();
  for (const row of exclusionRows) {
    const exclusion: GroupExclusion = {
      id: row.id,
      groupId: row.groupId,
      personId: row.personId,
      personName: row.personName,
      personRank: row.personRank,
      personConscriptionNumber: row.personConscriptionNumber,
      dayOfWeek: row.dayOfWeek,
      reason: row.reason,
      createdAt: row.created_at.getTime(),
    };
    const exclusions = exclusionsByGroup.get(row.groupId) ?? [];
    exclusions.push(exclusion);
    exclusionsByGroup.set(row.groupId, exclusions);
  }
  const snapshots = groups.map((group) => [
    group.id,
    buildDutyGroupSnapshotFromData(group, templates, dates, platoons, people, rulesByGroup, exclusionsByGroup, assignmentsByGroup),
  ] as const);
  return { templates, groups, platoons, groupSnapshots: Object.fromEntries(snapshots), weekDates: dates };
}

/** Explicit scheduler/action entry point. Snapshot reads never write assignments. */
export async function materializePostgresAutomaticDutyAssignments(
  from: string,
  to: string,
  selectedGroupIds?: string[],
): Promise<void> {
  const dates = scheduleDateRange(from, to);
  if (!dates) throw new Error("BAD_REQUEST");
  const selected = selectedGroupIds?.length ? new Set(selectedGroupIds) : null;
  await inPostgresTransaction(async (transaction) => {
    const groups = await getDutyGroups(transaction);
    const context: RotationContext = {
      people: await allPeopleSorted(transaction),
      exclusionsByGroup: new Map(),
      historyByGroup: new Map(),
      assignedByDate: new Map(),
    };
    const existingRows = await transaction<Array<{ id: string; groupId: string; personId: string; assignedDate: string | Date }>>`
      SELECT id, group_id AS "groupId", person_id AS "personId", assigned_date AS "assignedDate"
      FROM group_assignments
      WHERE assigned_date BETWEEN ${dates[0]}::date AND ${dates[dates.length - 1]}::date
    `;
    for (const row of existingRows) {
      const dateRows = context.assignedByDate.get(assignmentDate(row.assignedDate)) ?? [];
      dateRows.push({ id: row.id, groupId: row.groupId, personId: row.personId });
      context.assignedByDate.set(assignmentDate(row.assignedDate), dateRows);
    }
    for (const group of groups.filter((item) => !selected || selected.has(item.id))) {
      const rule = await getDutyRule(group.id, transaction);
      context.exclusionsByGroup.set(group.id, await getDutyExclusions(group.id, transaction));
      context.historyByGroup.set(group.id, await getAssignmentsForGroup(group.id, transaction));
      for (const date of dates) await ensureGroupAssignments(group, rule, date, transaction, context);
    }
  });
}

export async function refreshPostgresAutomaticDutyAssignments(
  from?: string,
  to?: string,
): Promise<GroupsSnapshot> {
  const dates = weekDates(new Date(), 7);
  await materializePostgresAutomaticDutyAssignments(from ?? dates[0], to ?? dates[dates.length - 1]);
  return getPostgresGroupsSnapshot();
}

export async function getPostgresGroupCandidates(groupId: string, from: string, to: string) {
  const dates = scheduleDateRange(from, to);
  if (!dates) throw new Error("BAD_REQUEST");
  const [group] = (await getDutyGroups()).filter((item) => item.id === groupId);
  if (!group) throw new Error("GROUP_NOT_FOUND");
  const rule = await getDutyRule(groupId);
  const exclusions = await getDutyExclusions(groupId);
  const people = await allPeopleSorted();
  const rows = await pg()<Array<{ personId: string; assignedDate: string | Date }>>`
    SELECT person_id AS "personId", assigned_date AS "assignedDate"
    FROM group_assignments
    WHERE group_id = ${groupId}
      AND assigned_date BETWEEN ${dates[0]}::date AND ${dates[dates.length - 1]}::date
  `;
  const assignedByDate = new Map<string, Set<string>>();
  for (const row of rows) {
    const date = assignmentDate(row.assignedDate);
    const ids = assignedByDate.get(date) ?? new Set<string>();
    ids.add(row.personId);
    assignedByDate.set(date, ids);
  }
  const candidateRule = rule.assignmentQuotas.length > 0 ? { ...rule, enabledPlatoons: [] } : rule;
  const availablePeopleByDate = Object.fromEntries(dates.map((date) => {
    const assigned = assignedByDate.get(date) ?? new Set<string>();
    const candidates = filterPeopleByAssignmentQuotas(
      filterCandidates(people, candidateRule, exclusions, date),
      rule.assignmentQuotas,
    );
    return [date, candidates.filter((person) => !assigned.has(person.id))];
  }));
  return { groupId, from: dates[0], to: dates[dates.length - 1], dates, availablePeopleByDate };
}

export async function createPostgresDutyGroup(input: GroupCreateInput): Promise<GroupsSnapshot> {
  const sql = pg();
  const [template] = await sql<Array<{ defaultPeoplePerDay: number; defaultActiveDays: unknown }>>`
    SELECT default_people_per_day AS "defaultPeoplePerDay", default_active_days AS "defaultActiveDays" FROM group_templates WHERE id = ${input.templateId}
  `;
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");
  const groupId = randomUUID();
  const now = Date.now();
  await inPostgresTransaction(async (transaction) => {
    await transaction`INSERT INTO duty_groups (id, template_id, name, notes, enabled, sort_order) VALUES (${groupId}, ${input.templateId}, ${input.name.trim()}, ${input.notes?.trim() ?? ""}, true, ${now})`;
    await transaction`INSERT INTO group_rules (id, group_id, enabled_platoons, people_per_day, assignment_quotas, auto_rotate, active_days, priority_mode, overlap_policy) VALUES (${randomUUID()}, ${groupId}, ${transaction.json([])}::jsonb, ${template.defaultPeoplePerDay}, ${transaction.json([])}::jsonb, true, ${transaction.json(normalizeActiveDays(template.defaultActiveDays))}::jsonb, 'oldest', 'exclusive')`;
  });
  return refreshPostgresAutomaticDutyAssignments();
}

export async function updatePostgresDutyGroup(input: GroupUpdateInput): Promise<GroupsSnapshot> {
  const sql = pg();
  const [current] = await sql<DbGroup[]>`SELECT id, template_id AS "templateId", name, notes, enabled, sort_order AS "sortOrder", created_at, updated_at FROM duty_groups WHERE id = ${input.id}`;
  if (!current) throw new Error("GROUP_NOT_FOUND");
  if (input.templateId) {
    const template = await sql`SELECT 1 FROM group_templates WHERE id = ${input.templateId}`;
    if (!template.length) throw new Error("TEMPLATE_NOT_FOUND");
  }
  const updated = input.expectedUpdatedAt === undefined
    ? await sql<DbGroup[]>`
        UPDATE duty_groups SET template_id = ${input.templateId ?? current.templateId}, name = ${input.name?.trim() ?? current.name},
          notes = ${input.notes?.trim() ?? current.notes}, enabled = ${input.enabled ?? current.enabled}, updated_at = now()
        WHERE id = ${input.id}
        RETURNING id, template_id AS "templateId", name, notes, enabled, sort_order AS "sortOrder", created_at, updated_at
      `
    : await sql<DbGroup[]>`
        UPDATE duty_groups SET template_id = ${input.templateId ?? current.templateId}, name = ${input.name?.trim() ?? current.name},
          notes = ${input.notes?.trim() ?? current.notes}, enabled = ${input.enabled ?? current.enabled}, updated_at = now()
        WHERE id = ${input.id}
          AND ${sql.unsafe(GROUP_UPDATED_AT_LOCK_SQL)} = ${input.expectedUpdatedAt}
        RETURNING id, template_id AS "templateId", name, notes, enabled, sort_order AS "sortOrder", created_at, updated_at
      `;
  if (!updated.length) throw new Error("GROUP_STALE_WRITE");
  const rematerialize =
    (input.enabled !== undefined && input.enabled !== current.enabled) ||
    (input.templateId !== undefined && input.templateId !== current.templateId);
  return rematerialize ? refreshPostgresAutomaticDutyAssignments() : getPostgresGroupsSnapshot();
}

export async function deletePostgresDutyGroup(id: string): Promise<GroupsSnapshot> {
  await pg()`DELETE FROM duty_groups WHERE id = ${id}`;
  return getPostgresGroupsSnapshot();
}

export async function updatePostgresDutyGroupRule(input: RuleUpdateInput): Promise<GroupsSnapshot> {
  const refreshDates = weekDates(new Date(), 7);
  await inPostgresTransaction(async (sql) => {
    const [group] = await sql<Array<{ updatedAt: Date }>>`
      SELECT updated_at AS "updatedAt" FROM duty_groups WHERE id = ${input.groupId} FOR UPDATE
    `;
    if (!group) throw new Error("GROUP_NOT_FOUND");
    if (
      input.expectedUpdatedAt !== undefined &&
      Math.floor(group.updatedAt.getTime()) !== input.expectedUpdatedAt
    ) {
      throw new Error("GROUP_STALE_WRITE");
    }
    const current = await getDutyRule(input.groupId, sql);
    const overlapPolicy = normalizeOverlapPolicy(input.overlapPolicy ?? current.overlapPolicy);
    const cleanupRows = current.overlapPolicy === "manual" && overlapPolicy === "exclusive"
      ? await sql<Array<{ id: string; groupId: string; groupName: string; assignedDate: string | Date }>>`
          SELECT other.id, other.group_id AS "groupId", dg.name AS "groupName", other.assigned_date AS "assignedDate"
          FROM group_assignments own
          JOIN group_assignments other
            ON other.person_id = own.person_id
           AND other.assigned_date = own.assigned_date
           AND other.group_id <> own.group_id
          JOIN duty_groups dg ON dg.id = other.group_id
          WHERE own.group_id = ${input.groupId}
            AND own.assigned_date BETWEEN ${refreshDates[0]}::date AND ${refreshDates[refreshDates.length - 1]}::date
        `
      : [];
    if (cleanupRows.length && !input.confirmOverlapCleanup) {
      const error = new Error("GROUP_OVERLAP_CLEANUP_REQUIRED") as Error & {
        cleanupCount?: number;
        conflicts?: GroupConflict[];
      };
      error.cleanupCount = cleanupRows.length;
      error.conflicts = cleanupRows.map((row) => ({
        groupId: row.groupId,
        groupName: row.groupName,
        date: assignmentDate(row.assignedDate),
        kind: "blocking",
      }));
      throw error;
    }
    const existing = await sql`SELECT 1 FROM group_rules WHERE group_id = ${input.groupId}`;
    if (!existing.length) {
      await sql`
        INSERT INTO group_rules (id, group_id, enabled_platoons, people_per_day, assignment_quotas, auto_rotate, active_days, priority_mode, overlap_policy)
        VALUES (${current.id}, ${current.groupId}, ${sql.json(current.enabledPlatoons)}::jsonb, ${current.peoplePerDay}, ${sql.json(current.assignmentQuotas)}::jsonb, ${current.autoRotate}, ${sql.json(current.activeDays)}::jsonb, ${current.priorityMode}, ${current.overlapPolicy})
        ON CONFLICT (group_id) DO NOTHING
      `;
    }
    const assignmentQuotas = normalizeAssignmentQuotas(input.assignmentQuotas ?? current.assignmentQuotas);
    const rule = {
      assignmentQuotas,
      // Empty assignmentQuotas must not wipe enabledPlatoons — only non-empty quotas derive the filter.
      enabledPlatoons: resolveRuleEnabledPlatoons(
        assignmentQuotas,
        input.enabledPlatoons,
        current.enabledPlatoons,
      ),
      peoplePerDay: assignmentQuotas.length > 0 ? quotaTotal(assignmentQuotas) : input.peoplePerDay ?? current.peoplePerDay,
      autoRotate: input.autoRotate ?? current.autoRotate,
      activeDays: normalizeActiveDays(input.activeDays ?? current.activeDays),
      priorityMode: normalizePriorityMode(input.priorityMode ?? current.priorityMode),
      overlapPolicy,
    };
    if (!Number.isInteger(rule.peoplePerDay) || rule.peoplePerDay < 1) throw new Error("PEOPLE_PER_DAY_INVALID");
    await sql`
      UPDATE group_rules SET enabled_platoons = ${sql.json(rule.enabledPlatoons)}::jsonb, people_per_day = ${rule.peoplePerDay},
        auto_rotate = ${rule.autoRotate}, assignment_quotas = ${sql.json(rule.assignmentQuotas)}::jsonb, active_days = ${sql.json(rule.activeDays)}::jsonb,
        priority_mode = ${rule.priorityMode}, overlap_policy = ${rule.overlapPolicy}
      WHERE group_id = ${input.groupId}
    `;
    if (cleanupRows.length) {
      await sql`DELETE FROM group_assignments WHERE id = ANY(${sql.array(cleanupRows.map((row) => row.id))})`;
    }
    const touched = input.expectedUpdatedAt === undefined
      ? await sql`UPDATE duty_groups SET updated_at = now() WHERE id = ${input.groupId} RETURNING id`
      : await sql`
          UPDATE duty_groups SET updated_at = now()
          WHERE id = ${input.groupId}
            AND ${sql.unsafe(GROUP_UPDATED_AT_LOCK_SQL)} = ${input.expectedUpdatedAt}
          RETURNING id
        `;
    if (!touched.length) throw new Error("GROUP_STALE_WRITE");
  });
  return refreshPostgresAutomaticDutyAssignments(refreshDates[0], refreshDates[refreshDates.length - 1]);
}

export async function rotatePostgresDutyGroup(groupId: string, date = localDateKey()): Promise<GroupsSnapshot> {
  await inPostgresTransaction(async (transaction) => {
    await lockAssignmentDay(transaction, date, groupId);
    const [group] = await transaction<DbGroup[]>`SELECT id, template_id AS "templateId", name, notes, enabled, sort_order AS "sortOrder", created_at, updated_at FROM duty_groups WHERE id = ${groupId} FOR UPDATE`;
    if (!group) throw new Error("GROUP_NOT_FOUND");
    await transaction`DELETE FROM group_assignments WHERE group_id = ${groupId} AND assigned_date = ${date}::date AND source = 'auto'`;
    await ensureGroupAssignments(toGroup(group), await getDutyRule(groupId, transaction), date, transaction);
  });
  return getPostgresGroupsSnapshot();
}

type AssignmentDateResult =
  | { assigned: true }
  | { assigned: false; skipped: GroupAssignmentRangeSkip };

async function assignPersonOnDate(
  groupId: string,
  personId: string,
  date: string,
  transaction: SqlExecutor,
  options: { skipInvalid: boolean },
): Promise<AssignmentDateResult> {
  const [group] = await transaction<Array<{ enabled: boolean }>>`SELECT enabled FROM duty_groups WHERE id = ${groupId} FOR UPDATE`;
  const [person] = await transaction<Array<{ platoonId: string }>>`SELECT platoon_id AS "platoonId" FROM people WHERE id = ${personId} FOR SHARE`;
  if (!group) throw new Error("GROUP_NOT_FOUND");
  if (!person) throw new Error("PERSON_NOT_FOUND");
  const rule = await getDutyRule(groupId, transaction);
  const dayOfWeek = dayOfWeekFromKey(date);
  const excluded = (await transaction`SELECT 1 FROM group_exclusions WHERE group_id = ${groupId} AND person_id = ${personId} AND (day_of_week IS NULL OR day_of_week = ${dayOfWeek}) LIMIT 1`).length > 0;
  // Quotas and enabledPlatoons share one filter: wrong platoon → platoon_disabled, not OVERFILLED.
  const reason = groupAssignmentIneligibility({
    groupEnabled: group.enabled,
    activeDays: rule.activeDays,
    dayOfWeek,
    enabledPlatoons: rulePlatoonFilter(rule),
    personPlatoonId: person.platoonId,
    excluded,
  });
  if (reason) {
    if (!options.skipInvalid) throw new GroupAssignmentIneligibleError(reason);
    return { assigned: false, skipped: { date, reason, conflicts: [] } };
  }

  const current = await getAssignmentsForGroupDate(groupId, date, transaction);
  if (current.some((assignment) => assignment.personId === personId)) {
    if (!options.skipInvalid) throw new Error("GROUP_ASSIGNMENT_ALREADY_EXISTS");
    return { assigned: false, skipped: { date, reason: "already_assigned", conflicts: [] } };
  }
  if (rule.assignmentQuotas.length > 0) {
    const people = await allPeopleSorted(transaction);
    const peopleById = new Map(people.map((person) => [person.id, person]));
    const counts = quotaAssignmentCounts(rule.assignmentQuotas, current, peopleById);
    const quotaIndex = rule.assignmentQuotas.findIndex((quota) => quota.platoonId === person.platoonId);
    if (quotaIndex < 0 || counts[quotaIndex] >= rule.assignmentQuotas[quotaIndex].count) {
      if (!options.skipInvalid) throw new Error("GROUP_ASSIGNMENT_OVERFILLED");
      return { assigned: false, skipped: { date, reason: "overfilled", conflicts: [] } };
    }
  } else if (current.length >= rule.peoplePerDay) {
    if (!options.skipInvalid) throw new Error("GROUP_ASSIGNMENT_OVERFILLED");
    return { assigned: false, skipped: { date, reason: "overfilled", conflicts: [] } };
  }

  const conflicts = await conflictRows(personId, date, groupId, transaction);
  const blockingConflicts = conflicts.filter((conflict) => conflict.kind === "blocking");
  if (blockingConflicts.length) {
    if (!options.skipInvalid) {
      const error = new Error("GROUP_ASSIGNMENT_CONFLICT") as Error & { conflicts?: GroupConflict[] };
      error.conflicts = blockingConflicts;
      throw error;
    }
    return { assigned: false, skipped: { date, reason: "conflict", conflicts: blockingConflicts } };
  }

  await writeDutyAssignment(groupId, personId, date, "manual", conflicts.length ? "allowed" : "clear", transaction);
  return { assigned: true };
}

export async function assignPostgresPersonToDutyGroup(groupId: string, personId: string, date = localDateKey()): Promise<GroupsSnapshot> {
  await inPostgresTransaction(async (transaction) => {
    await lockAssignmentDay(transaction, date, groupId, personId);
    await assignPersonOnDate(groupId, personId, date, transaction, { skipInvalid: false });
  });
  return getPostgresGroupsSnapshot();
}

export async function assignPostgresPersonToDutyGroupRange(
  groupId: string,
  personId: string,
  from: string,
  to: string,
): Promise<GroupAssignmentRangeResult> {
  const dates = scheduleDateRange(from, to);
  if (!dates) throw new Error("BAD_REQUEST");
  const result = await inPostgresTransaction(async (transaction) => {
    const assignedDates: string[] = [];
    const skippedDates: GroupAssignmentRangeSkip[] = [];
    for (const date of dates) {
      await lockAssignmentDay(transaction, date, groupId, personId);
      const dateResult = await assignPersonOnDate(groupId, personId, date, transaction, { skipInvalid: true });
      if (dateResult.assigned) assignedDates.push(date);
      else skippedDates.push(dateResult.skipped);
    }
    return { assignedDates, skippedDates };
  });
  return {
    ...result,
    from,
    to,
    snapshot: await getPostgresGroupsSnapshot(),
  };
}

export async function removePostgresDutyAssignment(assignmentId: string): Promise<GroupsSnapshot> {
  await pg()`DELETE FROM group_assignments WHERE id = ${assignmentId}`;
  return getPostgresGroupsSnapshot();
}

export async function excludePostgresPersonFromDutyGroup(groupId: string, personId: string, dayOfWeek: number | null, reason = ""): Promise<GroupsSnapshot> {
  if (dayOfWeek !== null && (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)) throw new Error("DAY_OF_WEEK_INVALID");
  await pg()`
    INSERT INTO group_exclusions (id, group_id, person_id, day_of_week, reason)
    VALUES (${randomUUID()}, ${groupId}, ${personId}, ${dayOfWeek}, ${reason.trim()}) ON CONFLICT DO NOTHING
  `;
  return refreshPostgresAutomaticDutyAssignments();
}

export async function includePostgresPersonInDutyGroup(exclusionId: string): Promise<GroupsSnapshot> {
  await pg()`DELETE FROM group_exclusions WHERE id = ${exclusionId}`;
  return refreshPostgresAutomaticDutyAssignments();
}

export async function getPostgresDutyGroupHistory(groupId?: string): Promise<GroupAssignment[]> {
  const rows = await pg()<DbAssignment[]>`
    SELECT id, group_id AS "groupId", person_id AS "personId", assigned_date AS "assignedDate", source, conflict_state AS "conflictState", created_at
    FROM group_assignments WHERE (${groupId ?? null}::text IS NULL OR group_id = ${groupId ?? null}::text)
    ORDER BY assigned_date DESC, created_at DESC LIMIT 300
  `;
  return enrichDutyAssignments(rows);
}

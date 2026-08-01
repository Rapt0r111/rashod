import type { DutyGroup, GroupAssignment, GroupConflict, GroupRule } from "@/features/groups/types";
import type { Person, Platoon } from "@/features/roster/types";
import {
  classifyOverlap,
  normalizeAssignmentQuotas,
  normalizeOverlapPolicy,
  normalizePriorityMode,
} from "@/features/groups/logic";
import { scheduleDateRange } from "@/features/schedule/logic";
import type { ScheduleSnapshot } from "@/features/schedule/types";
import { pg } from "./postgres";

type DbPerson = Omit<Person, "createdAt" | "updatedAt"> & {
  created_at: Date;
  updated_at: Date;
};

type DbAssignment = {
  id: string;
  groupId: string;
  personId: string;
  assignedDate: string | Date;
  source: string;
  conflictState: string;
  created_at: Date;
  personName: string | null;
  personRank: string | null;
  personConscriptionNumber: string | null;
};

type DbRule = {
  id: string | null;
  groupId: string;
  enabledPlatoons: unknown;
  peoplePerDay: number;
  assignmentQuotas: unknown;
  autoRotate: boolean;
  activeDays: unknown;
  priorityMode: unknown;
  overlapPolicy: unknown;
};

function assignmentDate(value: string | Date) {
  return typeof value === "string" ? value : value.toISOString().slice(0, 10);
}

function normalizeStringArray(value: unknown): string[] {
  if (typeof value === "string") {
    try { value = JSON.parse(value) as unknown; } catch { return []; }
  }
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))]
    : [];
}

function normalizeActiveDays(value: unknown): number[] {
  if (typeof value === "string") {
    try { value = JSON.parse(value) as unknown; } catch { return [0, 1, 2, 3, 4, 5, 6]; }
  }
  if (!Array.isArray(value)) return [0, 1, 2, 3, 4, 5, 6];
  return [...new Set(value.map(Number).filter((item) => Number.isInteger(item) && item >= 0 && item <= 6))].sort((a, b) => a - b);
}

function toPerson(row: DbPerson): Person {
  return {
    ...row,
    createdAt: row.created_at.getTime(),
    updatedAt: row.updated_at.getTime(),
  };
}

export async function getPostgresScheduleSnapshot(
  from: string,
  to: string,
): Promise<ScheduleSnapshot> {
  const dates = scheduleDateRange(from, to);
  if (!dates) throw new Error("BAD_REQUEST");

  const sql = pg();
  const [peopleRows, platoons, groups, ruleRows, rows] = await Promise.all([
    sql<DbPerson[]>`
      SELECT id, platoon_id AS "platoonId", rank, name,
        conscription_number AS "conscriptionNumber", location,
        sort_order AS "sortOrder", created_at, updated_at
      FROM people ORDER BY sort_order, name
    `,
    sql<Platoon[]>`
      SELECT id, key, label, sort_order AS "sortOrder", is_system AS "isSystem"
      FROM platoons ORDER BY sort_order, label
    `,
    sql<DutyGroup[]>`
      SELECT id, template_id AS "templateId", name, notes, enabled,
        sort_order AS "sortOrder", EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
        EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt"
      FROM duty_groups ORDER BY sort_order, name
    `,
    sql<DbRule[]>`
      SELECT gr.id, dg.id AS "groupId",
        COALESCE(gr.enabled_platoons, '[]'::jsonb) AS "enabledPlatoons",
        COALESCE(gr.people_per_day, gt.default_people_per_day) AS "peoplePerDay",
        COALESCE(gr.assignment_quotas, '[]'::jsonb) AS "assignmentQuotas",
        COALESCE(gr.auto_rotate, true) AS "autoRotate",
        COALESCE(gr.active_days, gt.default_active_days) AS "activeDays",
        COALESCE(gr.priority_mode, 'oldest') AS "priorityMode",
        COALESCE(gr.overlap_policy, 'exclusive') AS "overlapPolicy"
      FROM duty_groups dg
      JOIN group_templates gt ON gt.id = dg.template_id
      LEFT JOIN group_rules gr ON gr.group_id = dg.id
    `,
    sql<DbAssignment[]>`
      SELECT ga.id, ga.group_id AS "groupId", ga.person_id AS "personId",
        ga.assigned_date AS "assignedDate", ga.source,
        ga.conflict_state AS "conflictState", ga.created_at,
        p.name AS "personName", p.rank AS "personRank",
        p.conscription_number AS "personConscriptionNumber"
      FROM group_assignments ga
      LEFT JOIN people p ON p.id = ga.person_id
      WHERE ga.assigned_date BETWEEN ${from}::date AND ${to}::date
      ORDER BY ga.assigned_date, ga.group_id, ga.created_at
    `,
  ]);

  const assignmentsByPersonDate = new Map<string, DbAssignment[]>();
  for (const row of rows) {
    const key = `${row.personId}\u0000${assignmentDate(row.assignedDate)}`;
    const current = assignmentsByPersonDate.get(key) ?? [];
    current.push(row);
    assignmentsByPersonDate.set(key, current);
  }
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const overlapPolicies = new Map(
    ruleRows.map((row) => [row.groupId, normalizeOverlapPolicy(row.overlapPolicy)]),
  );
  const assignments: GroupAssignment[] = rows.map((row) => {
    const date = assignmentDate(row.assignedDate);
    const conflicts: GroupConflict[] = (assignmentsByPersonDate.get(`${row.personId}\u0000${date}`) ?? [])
      .filter((other) => other.groupId !== row.groupId)
      .map((other) => ({
        groupId: other.groupId,
        groupName: groupNames.get(other.groupId) ?? other.groupId,
        date,
        kind: classifyOverlap(
          overlapPolicies.get(row.groupId) ?? "exclusive",
          overlapPolicies.get(other.groupId) ?? "exclusive",
          other.source === "manual" ? "manual" : "auto",
        ),
      }));
    const source = row.source === "manual" ? "manual" : "auto";
    const hasBlockingConflict = conflicts.some((conflict) => conflict.kind === "blocking");
    return {
      id: row.id,
      groupId: row.groupId,
      personId: row.personId,
      personName: row.personName,
      personRank: row.personRank,
      personConscriptionNumber: row.personConscriptionNumber,
      assignedDate: date,
      source,
      conflictState: hasBlockingConflict || row.conflictState === "warning"
        ? "warning"
        : conflicts.length || row.conflictState === "allowed" ? "allowed" : "clear",
      conflicts,
      createdAt: row.created_at.getTime(),
    };
  });

  const groupRules = Object.fromEntries(ruleRows.map((row) => {
    const rule: GroupRule = {
      id: row.id ?? `legacy-${row.groupId}`,
      groupId: row.groupId,
      enabledPlatoons: normalizeStringArray(row.enabledPlatoons),
      peoplePerDay: row.peoplePerDay,
      assignmentQuotas: normalizeAssignmentQuotas(row.assignmentQuotas),
      autoRotate: row.autoRotate,
      activeDays: normalizeActiveDays(row.activeDays),
      priorityMode: normalizePriorityMode(row.priorityMode),
      overlapPolicy: normalizeOverlapPolicy(row.overlapPolicy),
    };
    return [row.groupId, rule] as const;
  }));

  return {
    from,
    to,
    dates,
    people: peopleRows.map(toPerson),
    platoons,
    groups,
    groupRules,
    assignments,
  };
}

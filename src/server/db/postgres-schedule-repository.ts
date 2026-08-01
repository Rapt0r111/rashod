import type { DutyGroup, GroupAssignment, GroupConflict } from "@/features/groups/types";
import type { Person, Platoon } from "@/features/roster/types";
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

function assignmentDate(value: string | Date) {
  return typeof value === "string" ? value : value.toISOString().slice(0, 10);
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
  const [peopleRows, platoons, groups, rows] = await Promise.all([
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
  const assignments: GroupAssignment[] = rows.map((row) => {
    const date = assignmentDate(row.assignedDate);
    const conflicts: GroupConflict[] = (assignmentsByPersonDate.get(`${row.personId}\u0000${date}`) ?? [])
      .filter((other) => other.groupId !== row.groupId)
      .map((other) => ({
        groupId: other.groupId,
        groupName: groupNames.get(other.groupId) ?? other.groupId,
        date,
      }));
    return {
      id: row.id,
      groupId: row.groupId,
      personId: row.personId,
      personName: row.personName,
      personRank: row.personRank,
      personConscriptionNumber: row.personConscriptionNumber,
      assignedDate: date,
      source: row.source === "manual" ? "manual" : "auto",
      conflictState: conflicts.length || row.conflictState === "warning" ? "warning" : "clear",
      conflicts,
      createdAt: row.created_at.getTime(),
    };
  });

  return {
    from,
    to,
    dates,
    people: peopleRows.map(toPerson),
    platoons,
    groups,
    assignments,
  };
}

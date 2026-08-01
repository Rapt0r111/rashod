import type { ScheduleSnapshot } from "./types";
import { compactDutyLabel, groupById, scheduleDateLabel } from "./logic";

function escapeCsv(value: string | number) {
  const raw = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function buildScheduleCsv(snapshot: ScheduleSnapshot) {
  const groups = groupById(snapshot.groups);
  const assignments = new Map<string, string[]>();
  for (const assignment of snapshot.assignments) {
    const key = `${assignment.personId}\u0000${assignment.assignedDate}`;
    const labels = assignments.get(key) ?? [];
    const group = groups.get(assignment.groupId);
    labels.push(group ? group.name : assignment.groupId);
    assignments.set(key, labels);
  }

  const header = ["№", "Взвод", "ФИО", ...snapshot.dates.map(scheduleDateLabel)];
  const rows = snapshot.people.map((person, index) => [
    index + 1,
    snapshot.platoons.find((platoon) => platoon.id === person.platoonId)?.label ?? "",
    person.name,
    ...snapshot.dates.map((date) => {
      const labels = assignments.get(`${person.id}\u0000${date}`) ?? [];
      return labels.map(compactDutyLabel).join(" / ");
    }),
  ]);
  return `\uFEFF${[header, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\r\n")}`;
}

export function exportScheduleCsv(csv: string, from: string, to: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `grafik-naryadov-${from}-${to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

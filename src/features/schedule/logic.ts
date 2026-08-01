import type { DutyGroup, GroupAssignment } from "../groups/types";

export const MAX_SCHEDULE_DAYS = 366;

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function dateKeyPlus(value: string, offset: number) {
  const date = dateFromKey(value);
  date.setDate(date.getDate() + offset);
  return dateKey(date);
}

export function scheduleDateRange(from: string, to: string, maxDays = MAX_SCHEDULE_DAYS): string[] | null {
  if (!isDateKey(from) || !isDateKey(to)) return null;
  const start = dateFromKey(from);
  const end = dateFromKey(to);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days < 1 || days > maxDays) return null;
  return Array.from({ length: days }, (_, index) => dateKeyPlus(from, index));
}

export function defaultScheduleRange(now = new Date()) {
  const from = dateKey(now);
  return { from, to: dateKeyPlus(from, 6) };
}

export type SchedulePreset = "today" | "seven" | "week" | "thirty" | "month" | "year";

export function schedulePresetRange(preset: SchedulePreset, now = new Date()) {
  const today = dateKey(now);
  if (preset === "today") return { from: today, to: today };
  if (preset === "seven") return { from: today, to: dateKeyPlus(today, 6) };
  if (preset === "thirty") return { from: today, to: dateKeyPlus(today, 29) };
  if (preset === "week") {
    const mondayOffset = (now.getDay() + 6) % 7;
    const from = dateKeyPlus(today, -mondayOffset);
    return { from, to: dateKeyPlus(from, 6) };
  }
  if (preset === "month") {
    const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: dateKey(fromDate), to: dateKey(toDate) };
  }
  return {
    from: dateKey(new Date(now.getFullYear(), 0, 1)),
    to: dateKey(new Date(now.getFullYear(), 11, 31)),
  };
}

export function scheduleMonthKey(value: string) {
  return value.slice(0, 7);
}

export function scheduleMonthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", { month: "short", year: "numeric" })
    .format(new Date(year, month - 1, 1))
    .replace(" г.", "");
}

export function scheduleDateLabel(value: string) {
  const [, month, day] = value.split("-");
  return `${day}.${month}`;
}

export function scheduleDayLabel(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short" })
    .format(dateFromKey(value))
    .replace(".", "");
}

export function compactDutyLabel(name: string) {
  const words = name
    .replace(/[«»()[\],.:;!?]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "—";
  const initials = words.map((word) => word[0]).join("").toUpperCase();
  return initials.length <= 6 ? initials : words[0].slice(0, 5).toUpperCase();
}

export function assignmentsForCell(
  assignments: readonly GroupAssignment[],
  personId: string,
  date: string,
) {
  return assignments.filter(
    (assignment) => assignment.personId === personId && assignment.assignedDate === date,
  );
}

export function groupById(groups: readonly DutyGroup[]) {
  return new Map(groups.map((group) => [group.id, group]));
}

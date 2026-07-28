export const DAY_NAMES = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
];

export const DAY_SHORT_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(new Date(year, month - 1, day));
}

export function formatDayLabel(day: number): string {
  return DAY_SHORT_NAMES[day] ?? "";
}

export function colorTokenClass(token: string): string {
  const tokens: Record<string, string> = {
    green: "[--tone:var(--green)] [--tone-soft:oklch(76%_0.17_151/0.12)] [--tone-line:oklch(76%_0.17_151/0.34)]",
    amber: "[--tone:var(--amber)] [--tone-soft:oklch(78%_0.16_74/0.12)] [--tone-line:oklch(78%_0.16_74/0.34)]",
    blue: "[--tone:var(--blue)] [--tone-soft:oklch(72%_0.15_242/0.12)] [--tone-line:oklch(72%_0.15_242/0.34)]",
    violet: "[--tone:var(--violet)] [--tone-soft:oklch(72%_0.18_302/0.12)] [--tone-line:oklch(72%_0.18_302/0.34)]",
    red: "[--tone:var(--red)] [--tone-soft:oklch(69%_0.18_28/0.12)] [--tone-line:oklch(69%_0.18_28/0.34)]",
    cyan: "[--tone:var(--cyan)] [--tone-soft:oklch(77%_0.14_191/0.12)] [--tone-line:oklch(77%_0.14_191/0.34)]",
    neutral: "[--tone:var(--neutral)] [--tone-soft:oklch(75%_0.025_286/0.12)] [--tone-line:oklch(75%_0.025_286/0.28)]",
  };
  return tokens[token] ?? tokens.neutral;
}

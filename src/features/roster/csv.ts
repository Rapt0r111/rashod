import type { Person, LocationOption, Platoon } from "./types";
import { locationLabel, platoonLabel } from "./utils";

function escapeCsv(value: string | number) {
  const raw = String(value ?? "");
  // Excel/LibreOffice execute formulas after CSV import even inside quoted fields.
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildRosterCsv(people: Person[], platoons: Platoon[], locations: LocationOption[]) {
  const header = ["Подразделение", "Номер призыва", "Звание", "ФИО", "Местонахождение"];
  const rows = people.map((person) => [
    platoonLabel(person.platoonId, platoons),
    person.conscriptionNumber ?? "",
    person.rank,
    person.name,
    locationLabel(person.location, locations),
  ]);
  return `\uFEFF${[header, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\r\n")}`;
}

export function exportCsvFile(csv: string) {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `stroevaya-${date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

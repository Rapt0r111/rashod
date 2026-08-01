import { describe, expect, it } from "vitest";
import { buildScheduleCsv } from "@/features/schedule/csv";
import {
  assignmentsForCell,
  compactDutyLabel,
  defaultScheduleRange,
  scheduleDateRange,
  scheduleDateLabel,
} from "@/features/schedule/logic";
import type { ScheduleSnapshot } from "@/features/schedule/types";

const snapshot: ScheduleSnapshot = {
  from: "2026-07-27",
  to: "2026-08-03",
  dates: ["2026-07-27", "2026-07-28"],
  people: [
    {
      id: "person-1",
      platoonId: "platoon-1",
      rank: "рядовой",
      name: "Иванов И.И.",
      conscriptionNumber: null,
      location: "rota",
      sortOrder: 1,
      createdAt: 0,
      updatedAt: 0,
    },
  ],
  platoons: [{ id: "platoon-1", key: "one", label: "1 взвод", sortOrder: 1, isSystem: true }],
  groups: [{
    id: "group-1",
    templateId: "template-1",
    name: "Дежурный по роте",
    notes: "",
    enabled: true,
    sortOrder: 1,
    createdAt: 0,
    updatedAt: 0,
  }],
  assignments: [{
    id: "assignment-1",
    groupId: "group-1",
    personId: "person-1",
    personName: "Иванов И.И.",
    personRank: "рядовой",
    personConscriptionNumber: null,
    assignedDate: "2026-07-27",
    source: "auto",
    conflictState: "clear",
    conflicts: [],
    createdAt: 0,
  }],
};

describe("schedule logic", () => {
  it("builds a bounded inclusive date range", () => {
    expect(scheduleDateRange("2026-07-27", "2026-08-03")).toHaveLength(8);
    expect(scheduleDateRange("2026-07-27", "2026-08-27")).toBeNull();
    expect(scheduleDateRange("2026-02-29", "2026-03-01")).toBeNull();
  });

  it("uses today plus seven days as the default print period", () => {
    expect(defaultScheduleRange(new Date(2026, 6, 27))).toEqual({ from: "2026-07-27", to: "2026-08-03" });
  });

  it("keeps compact duty labels and exact cell lookup deterministic", () => {
    expect(scheduleDateLabel("2026-07-27")).toBe("27.07");
    expect(compactDutyLabel("Дежурный по роте")).toBe("ДПР");
    expect(assignmentsForCell(snapshot.assignments, "person-1", "2026-07-27")).toHaveLength(1);
    expect(assignmentsForCell(snapshot.assignments, "person-1", "2026-07-28")).toHaveLength(0);
  });

  it("exports a spreadsheet-safe UTF-8 schedule", () => {
    const csv = buildScheduleCsv(snapshot);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("27.07");
    expect(csv).toContain("ДПР");
    expect(csv).toContain("Иванов И.И.");
  });
});
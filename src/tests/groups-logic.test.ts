import { describe, expect, it } from "vitest";
import type { Person } from "@/features/roster/types";
import type { GroupAssignment, GroupExclusion } from "@/features/groups/types";
import {
  dayOfWeekFromKey,
  filterCandidates,
  findExcessAutomaticAssignmentIds,
  findStaleAutomaticAssignmentIds,
  pickByOldestAssignment,
  pickRandomAssignment,
  pickRotationCandidates,
  weekDates,
} from "@/features/groups/logic";

const people: Person[] = [
  makePerson("p1", "plt-1", 1, "Иванов И.И."),
  makePerson("p2", "plt-1", 2, "Петров П.П."),
  makePerson("p3", "plt-2", 3, "Сидоров С.С."),
];

function makePerson(
  id: string,
  platoonId: string,
  sortOrder: number,
  name: string,
): Person {
  return {
    id,
    platoonId,
    rank: "рядовой",
    name,
    conscriptionNumber: null,
    location: "rota",
    sortOrder,
    createdAt: 1,
    updatedAt: 1,
  };
}

function assignment(
  personId: string,
  assignedDate: string,
): Pick<GroupAssignment, "personId" | "assignedDate"> {
  return { personId, assignedDate };
}

describe("group candidate filters", () => {
  it("uses platoon filters and day exclusions together", () => {
    const exclusions: Pick<GroupExclusion, "personId" | "dayOfWeek">[] = [
      { personId: "p2", dayOfWeek: dayOfWeekFromKey("2026-07-06") },
      { personId: "p3", dayOfWeek: null },
    ];

    expect(
      filterCandidates(
        people,
        { enabledPlatoons: ["plt-1"] },
        exclusions,
        "2026-07-06",
      ).map((item) => item.id),
    ).toEqual(["p1"]);
  });

  it("marks only automatic assignments outside the selected platoons as stale", () => {
    expect(
      findStaleAutomaticAssignmentIds(
        [
          { id: "auto-1", personId: "p1", source: "auto" },
          { id: "manual-2", personId: "p2", source: "manual" },
          { id: "auto-3", personId: "p3", source: "auto" },
        ],
        new Set(["p1", "p2"]),
      ),
    ).toEqual(["auto-3"]);
  });

  it("reduces automatic assignments to the limit without deleting manual overrides", () => {
    expect(
      findExcessAutomaticAssignmentIds(
        [
          { id: "auto-1", source: "auto" },
          { id: "manual-2", source: "manual" },
          { id: "auto-3", source: "auto" },
          { id: "auto-4", source: "auto" },
        ],
        2,
      ),
    ).toEqual(["auto-3", "auto-4"]);
  });
});

describe("group rotation priority", () => {
  it("picks people with oldest or missing assignments first", () => {
    const picked = pickByOldestAssignment(
      people,
      [assignment("p1", "2026-07-05"), assignment("p2", "2026-07-01")],
      2,
    );

    expect(picked.map((item) => item.id)).toEqual(["p3", "p2"]);
  });

  it("avoids people already assigned on the same date before fallback", () => {
    const picked = pickRotationCandidates(
      people,
      [assignment("p1", "2026-07-01"), assignment("p2", "2026-07-02")],
      2,
      new Set(["p1", "p3"]),
    );

    expect(picked.map((item) => item.id)).toEqual(["p2", "p3"]);
  });

  it("can pick randomly without assignment history priority", () => {
    const picked = pickRotationCandidates(
      people,
      [assignment("p1", "2026-07-01"), assignment("p2", "2026-07-02")],
      2,
      new Set(),
      "random",
      () => 0,
    );

    expect(picked.map((item) => item.id)).toEqual(["p2", "p3"]);
  });

  it("keeps same-date conflict avoidance before random fallback", () => {
    const picked = pickRotationCandidates(
      people,
      [],
      2,
      new Set(["p1", "p3"]),
      "random",
      () => 0,
    );

    expect(picked.map((item) => item.id)).toEqual(["p2", "p3"]);
  });

  it("shuffles direct random picks deterministically when rng is injected", () => {
    expect(pickRandomAssignment(people, 2, () => 0).map((item) => item.id)).toEqual(["p2", "p3"]);
  });
});

describe("group week horizon", () => {
  it("builds seven dates starting from today", () => {
    expect(weekDates(new Date(2026, 6, 6), 7)).toEqual([
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
    ]);
  });
});

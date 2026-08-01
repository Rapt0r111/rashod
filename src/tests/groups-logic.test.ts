import { describe, expect, it } from "vitest";
import type { Person } from "@/features/roster/types";
import type { GroupAssignment, GroupExclusion } from "@/features/groups/types";
import {
  dayOfWeekFromKey,
  classifyOverlap,
  filterCandidates,
  findExcessAutomaticAssignmentIds,
  filterPeopleByAssignmentQuotas,
  findStaleAutomaticAssignmentIds,
  pickByOldestAssignment,
  pickRandomAssignment,
  normalizeAssignmentQuotas,
  quotaAssignmentCounts,
  quotaTotal,
  pickRotationCandidates,
  resolveRuleEnabledPlatoons,
  rulePlatoonFilter,
  selectQuotaRotationPool,
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
  it("allows only manual overlap when both groups explicitly allow it", () => {
    expect(classifyOverlap("manual", "manual", "manual")).toBe("allowed");
    expect(classifyOverlap("manual", "exclusive", "manual")).toBe("blocking");
    expect(classifyOverlap("manual", "manual", "auto")).toBe("blocking");
    expect(classifyOverlap("exclusive", "manual", "manual")).toBe("blocking");
  });

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

describe("group assignment quotas", () => {
  it("keeps exact counts per dynamically selected platoon", () => {
    const quotaPeople = [
      ...people,
      makePerson("p4", "plt-2", 4, "Орлов О.О."),
      makePerson("p5", "plt-3", 5, "Кузнецов К.К."),
    ];
    const quotas = normalizeAssignmentQuotas([
      { platoonId: "plt-1", count: 1 },
      { platoonId: "plt-2", count: 2 },
      { platoonId: "plt-3", count: 1 },
      { platoonId: "plt-1", count: 9 },
    ]);
    const candidates = filterPeopleByAssignmentQuotas(quotaPeople, quotas);
    const peopleById = new Map(quotaPeople.map((person) => [person.id, person]));

    expect(quotas).toEqual([
      { platoonId: "plt-1", count: 1 },
      { platoonId: "plt-2", count: 2 },
      { platoonId: "plt-3", count: 1 },
    ]);
    expect(quotaTotal(quotas)).toBe(4);
    expect(candidates.map((person) => person.platoonId)).toEqual(["plt-1", "plt-1", "plt-2", "plt-2", "plt-3"]);
    expect(quotaAssignmentCounts(
      quotas,
      [assignment("p1", "2026-07-06"), assignment("p3", "2026-07-06"), assignment("p4", "2026-07-06"), assignment("p5", "2026-07-06")],
      peopleById,
    )).toEqual([1, 2, 1]);
  });

  it("keeps enabledPlatoons when saving empty quotas (platoon filter mode)", () => {
    expect(
      resolveRuleEnabledPlatoons([], ["plt-1", "plt-2"], ["plt-old"]),
    ).toEqual(["plt-1", "plt-2"]);
    expect(resolveRuleEnabledPlatoons([], [], ["plt-old"])).toEqual([]);
    expect(resolveRuleEnabledPlatoons([], undefined, ["plt-old"])).toEqual(["plt-old"]);
  });

  it("derives enabledPlatoons from non-empty assignment quotas", () => {
    expect(
      resolveRuleEnabledPlatoons(
        [{ platoonId: "plt-1", count: 2 }, { platoonId: "plt-3", count: 1 }],
        ["plt-ignored"],
        ["plt-old"],
      ),
    ).toEqual(["plt-1", "plt-3"]);
  });

  it("exposes the same platoon filter for eligibility in quota and free modes", () => {
    expect(
      rulePlatoonFilter({
        enabledPlatoons: ["plt-old"],
        assignmentQuotas: [{ platoonId: "plt-1", count: 1 }, { platoonId: "plt-2", count: 2 }],
      }),
    ).toEqual(["plt-1", "plt-2"]);
    expect(
      rulePlatoonFilter({ enabledPlatoons: ["plt-1"], assignmentQuotas: [] }),
    ).toEqual(["plt-1"]);
    expect(rulePlatoonFilter({ enabledPlatoons: [], assignmentQuotas: [] })).toEqual([]);
  });

  it("keeps same-date conflicts in the quota rotation pool for fallback", () => {
    const pool = selectQuotaRotationPool(
      people,
      "plt-1",
      new Set(["p2"]),
    );
    expect(pool.map((person) => person.id)).toEqual(["p1"]);

    const blocked = new Set(["p1"]);
    const short = pickRotationCandidates(
      selectQuotaRotationPool(people, "plt-1", new Set()),
      [],
      2,
      blocked,
    );
    // p1 blocked first pass; fallback still fills from same platoon when free seats run out.
    expect(short.map((person) => person.id)).toEqual(["p2", "p1"]);
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

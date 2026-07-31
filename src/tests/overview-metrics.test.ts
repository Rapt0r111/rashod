import { describe, expect, it } from "vitest";
import {
  overviewLocationMetrics,
  platoonLocationMatrix,
  rosterBalance,
} from "@/features/roster/roster-metrics";
import type { LocationGroup, LocationOption, Person, Platoon } from "@/features/roster/types";

const locations: LocationOption[] = [
  { id: "rota", key: "rota", label: "Рота", colorToken: "green", isQuick: true, quickCode: "Р", isSystem: true, sortOrder: 10 },
  { id: "naryad", key: "naryad", label: "Наряд", colorToken: "cyan", isQuick: true, quickCode: "Н", isSystem: true, sortOrder: 20 },
  { id: "technopark", key: "technopark", label: "Технопарк", colorToken: "blue", isQuick: true, quickCode: "Т", isSystem: true, sortOrder: 30 },
];

function person(id: string, location: string): Person {
  return { id, platoonId: "platoon", rank: "рядовой", name: id, conscriptionNumber: null, location, sortOrder: Number(id), createdAt: 1, updatedAt: 1 };
}

function group(id: string, label: string, locationKeys: string[], enabled = true): LocationGroup {
  return { id, label, colorToken: "violet", enabled, sortOrder: Number(id), locationKeys };
}

describe("overview location metrics", () => {
  it("renders a group once and exposes member counts for expansion", () => {
    const metrics = overviewLocationMetrics(
      [person("1", "rota"), person("2", "naryad"), person("3", "technopark")],
      locations,
      [group("1", "Рота и наряд", ["rota", "naryad"])],
    );

    expect(metrics.find((item) => item.key === "group:1")?.count).toBe(2);
    expect(metrics.find((item) => item.key === "group:1")?.locationKeys).toEqual(["rota", "naryad"]);
    expect(metrics.some((item) => item.key === "location:rota")).toBe(false);
    expect(metrics.some((item) => item.key === "location:naryad")).toBe(false);
    expect(metrics.find((item) => item.key === "group:1")?.members).toEqual([
      { key: "rota", label: "Рота", token: "green", count: 1 },
      { key: "naryad", label: "Наряд", token: "cyan", count: 1 },
    ]);
  });

  it("keeps the first group as owner when stale overlap exists", () => {
    const metrics = overviewLocationMetrics(
      [person("1", "rota"), person("2", "ДТП")],
      locations,
      [
        group("1", "Рота и наряд", ["rota", "naryad"]),
        group("2", "Технопарк и ДТП", ["rota", "technopark", "ДТП"]),
      ],
    );

    expect(metrics.find((item) => item.key === "group:1")?.count).toBe(1);
    expect(metrics.find((item) => item.key === "group:2")?.count).toBe(1);
    expect(metrics.find((item) => item.key === "group:2")?.members?.map((item) => item.key)).toEqual(["technopark", "ДТП"]);
    expect(metrics.some((item) => item.key === "custom:ДТП")).toBe(false);
  });

  it("shows a single-member group as a group and keeps disabled members standalone", () => {
    const grouped = overviewLocationMetrics(
      [person("1", "rota")],
      locations,
      [group("1", "Рота", ["rota"])],
    );
    expect(grouped.find((item) => item.key === "group:1")?.members).toHaveLength(1);

    const disabled = overviewLocationMetrics(
      [person("1", "rota")],
      locations,
      [group("1", "Скрытое объединение", ["rota"], false)],
    );
    expect(disabled.find((item) => item.key === "location:rota")?.count).toBe(1);
  });

  it("does not expose disabled groups", () => {
    const metrics = overviewLocationMetrics(
      [person("1", "rota")],
      locations,
      [group("1", "Скрытое объединение", ["rota"], false)],
    );

    expect(metrics.some((item) => item.key === "group:1")).toBe(false);
    expect(metrics.find((item) => item.key === "location:rota")?.count).toBe(1);
    expect(metrics.find((item) => item.key === "location:rota")?.locationKeys).toEqual(["rota"]);
  });
});

describe("roster balance", () => {
  it("splits list into present and away with invariant total", () => {
    const people = [
      person("1", "rota"),
      person("2", "rota"),
      person("3", "naryad"),
      person("4", "technopark"),
    ];
    const balance = rosterBalance(people);
    expect(balance).toEqual({
      total: 4,
      present: 2,
      away: 2,
      presentPct: 50,
    });
    expect(balance.present + balance.away).toBe(balance.total);
  });
});

describe("platoon location matrix", () => {
  it("counts people by platoon and location for drill-down", () => {
    const platoons: Platoon[] = [
      { id: "p1", key: "vz1", label: "1 взвод", sortOrder: 10, isSystem: true },
      { id: "p2", key: "vz2", label: "2 взвод", sortOrder: 20, isSystem: true },
    ];
    const people: Person[] = [
      { ...person("1", "rota"), platoonId: "p1" },
      { ...person("2", "naryad"), platoonId: "p1" },
      { ...person("3", "rota"), platoonId: "p2" },
    ];
    const matrix = platoonLocationMatrix(people, platoons, locations);
    expect(matrix.grandTotal).toBe(3);
    expect(matrix.locationKeys).toEqual(["rota", "naryad"]);
    expect(matrix.rows.find((row) => row.platoon.id === "p1")?.byLocation).toEqual({
      rota: 1,
      naryad: 1,
    });
    expect(matrix.columnTotals.rota).toBe(2);
  });
});

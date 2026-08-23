import { describe, expect, it } from "vitest";
import {
  commandStripLocationMetrics,
  locationsAndCustom,
  locationsAndQuick,
  overviewLocationMetrics,
  platoonLocationMatrix,
  presentLocationKeys,
  rosterBalance,
} from "@/features/roster/roster-metrics";
import type { LocationGroup, LocationOption, Person, Platoon } from "@/features/roster/types";
import { formatLocationDeltas } from "@/features/roster/utils";

const locations: LocationOption[] = [
  { id: "rota", key: "rota", label: "Рота", colorToken: "green", isQuick: true, quickCode: "Р", isSystem: true, countsAsPresent: true, sortOrder: 10 },
  { id: "naryad", key: "naryad", label: "Наряд", colorToken: "cyan", isQuick: true, quickCode: "Н", isSystem: true, countsAsPresent: false, sortOrder: 20 },
  { id: "technopark", key: "technopark", label: "Технопарк", colorToken: "blue", isQuick: true, quickCode: "Т", isSystem: true, countsAsPresent: false, sortOrder: 30 },
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
    const balance = rosterBalance(people, presentLocationKeys(locations));
    expect(balance).toEqual({
      total: 4,
      present: 2,
      away: 2,
      presentPct: 50,
    });
    expect(balance.present + balance.away).toBe(balance.total);
  });

  it("allows every location to stop counting as present", () => {
    const nonePresent = locations.map((location) => ({ ...location, countsAsPresent: false }));
    expect(presentLocationKeys(nonePresent)).toEqual([]);
    const people = [person("1", "rota"), person("2", "naryad")];
    expect(rosterBalance(people, presentLocationKeys(nonePresent)).present).toBe(0);
  });

  it("honors multiple countsAsPresent locations", () => {
    const withNaryadPresent: LocationOption[] = locations.map((location) =>
      location.key === "naryad" ? { ...location, countsAsPresent: true } : location,
    );
    const people = [
      person("1", "rota"),
      person("2", "naryad"),
      person("3", "technopark"),
    ];
    const balance = rosterBalance(people, presentLocationKeys(withNaryadPresent));
    expect(balance.present).toBe(2);
    expect(balance.away).toBe(1);
  });
});

describe("location deltas", () => {
  it("formats net from/to counts for batch toast", () => {
    const text = formatLocationDeltas(
      [
        { from: "rota", to: "naryad" },
        { from: "rota", to: "naryad" },
        { from: "technopark", to: "rota" },
      ],
      locations,
    );
    expect(text).toContain("Рота -1");
    expect(text).toContain("Наряд +2");
    expect(text).toContain("Технопарк -1");
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

  it("includes a typed non-catalog place while occupied and drops it when empty", () => {
    const typed = "Полевой госпиталь";
    const platoons: Platoon[] = [
      { id: "p1", key: "vz1", label: "1 взвод", sortOrder: 10, isSystem: true },
    ];
    const occupied = [ { ...person("1", typed), platoonId: "p1" } ];
    const matrix = platoonLocationMatrix(occupied, platoons, locations);
    expect(matrix.locationKeys).toContain(typed);
    expect(matrix.columnTotals[typed]).toBe(1);
    expect(locations.some((location) => location.key === typed)).toBe(false);

    const vacated = [ { ...person("1", "rota"), platoonId: "p1" } ];
    expect(platoonLocationMatrix(vacated, platoons, locations).locationKeys).not.toContain(typed);
  });
});

describe("typed custom locations", () => {
  it("counts and labels a occupied non-catalog place, then drops it when empty", () => {
    const typed = "Полевой госпиталь";
    const occupied = [person("1", typed), person("2", "rota")];
    const distribution = locationsAndCustom(occupied, locations);
    expect(distribution.find((item) => item.key === typed)).toEqual({
      key: typed,
      label: typed,
      token: "neutral",
      count: 1,
    });
    expect(locations.some((location) => location.key === typed || location.label === typed)).toBe(false);

    const metrics = overviewLocationMetrics(occupied, locations, []);
    const custom = metrics.find((item) => item.kind === "custom" && item.key === `custom:${typed}`);
    expect(custom?.label).toBe(typed);
    expect(custom?.count).toBe(1);
    expect(metrics.find((item) => item.key === "location:rota")?.count).toBe(1);

    const present = rosterBalance(occupied, presentLocationKeys(locations));
    expect(present.present).toBe(1);
    expect(present.away).toBe(1);

    const vacated = [person("1", "rota"), person("2", "rota")];
    expect(locationsAndCustom(vacated, locations).some((item) => item.key === typed)).toBe(false);
    expect(
      overviewLocationMetrics(vacated, locations, []).some((item) => item.key === `custom:${typed}`),
    ).toBe(false);
  });
});

describe("quick locations", () => {
  const catalog: LocationOption[] = [
    ...locations,
    {
      id: "otpusk",
      key: "otpusk",
      label: "Отпуск",
      colorToken: "neutral",
      isQuick: false,
      quickCode: null,
      isSystem: true,
      countsAsPresent: false,
      sortOrder: 80,
    },
  ];

  it("keeps empty isQuick places in the All Platoons filter", () => {
    const items = locationsAndQuick([person("1", "rota")], catalog);
    expect(items.map((item) => item.key)).toEqual(["rota", "naryad", "technopark"]);
    expect(items.find((item) => item.key === "naryad")?.count).toBe(0);
    expect(items.some((item) => item.key === "otpusk")).toBe(false);
  });

  it("keeps occupied non-quick and custom places after the quick set", () => {
    const typed = "Полевой госпиталь";
    const items = locationsAndQuick(
      [person("1", "rota"), person("2", "otpusk"), person("3", typed)],
      catalog,
    );
    expect(items.map((item) => item.key)).toEqual([
      "rota",
      "naryad",
      "technopark",
      "otpusk",
      typed,
    ]);
  });

  it("always shows isQuick locations on the command strip, even at zero", () => {
    const strip = commandStripLocationMetrics([person("1", "rota")], catalog, []);
    expect(strip.map((item) => item.locationKeys[0])).toEqual(["rota", "naryad", "technopark"]);
    expect(strip.find((item) => item.locationKeys[0] === "technopark")?.count).toBe(0);
  });

  it("still lists an occupied non-quick place after the quick chips", () => {
    const strip = commandStripLocationMetrics(
      [person("1", "rota"), person("2", "otpusk")],
      catalog,
      [],
    );
    expect(strip.map((item) => item.locationKeys[0])).toEqual([
      "rota",
      "naryad",
      "technopark",
      "otpusk",
    ]);
  });

  it("keeps isQuick locations as their own chips even inside a group", () => {
    const strip = commandStripLocationMetrics(
      [person("1", "rota")],
      catalog,
      [group("1", "Рабочие", ["rota", "naryad"])],
    );
    expect(strip.map((item) => item.locationKeys.join("+"))).toEqual([
      "rota",
      "naryad",
      "technopark",
    ]);
  });
});

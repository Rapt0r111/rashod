import { describe, expect, it } from "vitest";
import { createSeedData } from "@/server/db/seed";
import { buildRosterCsv } from "@/features/roster/csv";
import {
  abbreviateName,
  countInRota,
  filterPeople,
  locationLabel,
} from "@/features/roster/utils";

describe("seed data", () => {
  it("creates stable default roster", () => {
    const first = createSeedData();
    const second = createSeedData();
    expect(first.people).toHaveLength(71);
    expect(first.platoons).toHaveLength(4);
    expect(first.locations).toHaveLength(8);
    expect(first.people.map((person) => person.id)).toEqual(
      second.people.map((person) => person.id),
    );
    expect(countInRota(first.people)).toBe(71);
  });
});

describe("filtering", () => {
  it("searches by rank and name without case sensitivity", () => {
    const seed = createSeedData();
    expect(filterPeople(seed.people, "капитан")).toHaveLength(1);
    expect(filterPeople(seed.people, "ковал")[0]?.name).toContain("Ковалёв");
  });

  it("searches by conscription number", () => {
    const seed = createSeedData();
    const people = seed.people.map((person, index) => ({
      ...person,
      conscriptionNumber: index === 0 ? "12" : null,
    }));
    expect(filterPeople(people, "12").map((person) => person.id)).toEqual([people[0].id]);
  });
});

describe("name formatting", () => {
  it("keeps surname and compacts first name plus patronymic to initials", () => {
    expect(
      abbreviateName(
        "\u0418\u0432\u0430\u043d\u043e\u0432 \u0418\u0432\u0430\u043d \u0418\u0432\u0430\u043d\u043e\u0432\u0438\u0447",
      ),
    ).toBe("\u0418\u0432\u0430\u043d\u043e\u0432 \u0418.\u0418.");
    expect(
      abbreviateName(
        "\u041a\u043e\u0432\u0430\u043b\u0451\u0432 \u0410.\u041f.",
      ),
    ).toBe("\u041a\u043e\u0432\u0430\u043b\u0451\u0432 \u0410.\u041f.");
    expect(abbreviateName("\u041f\u0435\u0442\u0440\u043e\u0432")).toBe(
      "\u041f\u0435\u0442\u0440\u043e\u0432",
    );
  });
});

describe("csv export", () => {
  it("uses BOM, semicolon delimiter and location labels", () => {
    const seed = createSeedData();
    const csv = buildRosterCsv(
      seed.people.slice(0, 1),
      seed.platoons,
      seed.locations,
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(';"";"сержант";');
    expect(csv).toContain('"Рота"');
    expect(locationLabel("rota", seed.locations)).toBe("Рота");
  });

  it("exports the conscription number column", () => {
    const seed = createSeedData();
    const csv = buildRosterCsv(
      [{ ...seed.people[0], conscriptionNumber: "12" }],
      seed.platoons,
      seed.locations,
    );
    expect(csv).toContain('"Номер призыва"');
    expect(csv).toContain(';"12";');
  });

  it("neutralizes spreadsheet formulas in editable values", () => {
    const seed = createSeedData();
    const [person] = seed.people;
    const csv = buildRosterCsv(
      [{ ...person, name: "=HYPERLINK(\"https://attacker.invalid\")" }],
      seed.platoons,
      seed.locations,
    );
    expect(csv).toContain("'=HYPERLINK");
  });
});

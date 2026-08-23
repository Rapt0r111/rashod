import { describe, expect, it } from "vitest";
import { locationsAndCustom, overviewLocationMetrics } from "@/features/roster/roster-metrics";
import { pg } from "@/server/db/postgres";
import {
  changePostgresPersonLocation,
  getPostgresSnapshot,
} from "@/server/db/postgres-roster-repository";

describe("typed custom location writes", () => {
  it("stores a trimmed non-catalog place without inserting into locations", async () => {
    const sql = pg();
    const typed = `Полевой госпиталь ${Date.now()}`;
    const [person] = await sql<Array<{ id: string; location: string }>>`
      SELECT id, location FROM people ORDER BY sort_order, name LIMIT 1
    `;
    expect(person?.id).toBeTruthy();
    const original = person.location;
    const [{ count: beforeCount }] = await sql<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM locations
    `;
    const [{ peopleFk }] = await sql<Array<{ peopleFk: number }>>`
      SELECT count(*)::int AS "peopleFk"
      FROM pg_constraint
      WHERE conname = 'people_location_fkey'
    `;
    expect(peopleFk).toBe(0);

    try {
      await expect(changePostgresPersonLocation(person.id, "   ")).rejects.toThrow(
        "LOCATION_REQUIRED",
      );

      const first = await changePostgresPersonLocation(person.id, `  ${typed}  `);
      expect(first.person.location).toBe(typed);

      const [{ count: afterCount }] = await sql<Array<{ count: number }>>`
        SELECT count(*)::int AS count FROM locations
      `;
      expect(afterCount).toBe(beforeCount);

      const snapshot = await getPostgresSnapshot();
      expect(snapshot.people.find((item) => item.id === person.id)?.location).toBe(typed);
      expect(
        snapshot.locations.some((item) => item.key === typed || item.label === typed),
      ).toBe(false);

      const metrics = overviewLocationMetrics(
        snapshot.people,
        snapshot.locations,
        snapshot.locationGroups,
      );
      expect(
        metrics.some((item) => item.kind === "custom" && item.label === typed && item.count >= 1),
      ).toBe(true);
      expect(
        locationsAndCustom(snapshot.people, snapshot.locations).some((item) => item.key === typed),
      ).toBe(true);

      const second = await changePostgresPersonLocation(person.id, typed);
      expect(second.person.location).toBe(typed);
      expect(second.log).toBeNull();
    } finally {
      await changePostgresPersonLocation(person.id, original);
    }
  });
});

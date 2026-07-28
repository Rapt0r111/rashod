import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Filter UI contracts", () => {
  it("uses alphabetical sorting by default and hides a one-option sorter", () => {
    const search = read("src/components/search-sort-control.tsx");
    const rosterState = read("src/features/roster/state.ts");

    expect(search.indexOf('{ key: "alpha", label: "А–Я" }')).toBeLessThan(
      search.indexOf('{ key: "rank", label: "По званию" }'),
    );
    expect(search).toContain("const shouldShowSort = showSort && options.length > 1;");
    expect(rosterState).toContain('sort: { key: "alpha", direction: "asc" }');
  });

  it("keeps selected roster filters highlighted and toggleable", () => {
    const roster = read("src/features/roster/components/main-content.tsx");

    expect(roster).toContain("selectedKeys.includes(item.key)");
    expect(roster).toContain("border-accent bg-accent font-extrabold");
    expect(roster).toContain("<CheckIcon size={14} weight=\"bold\"");
    expect(roster).toContain(
      "aria-pressed={selected}",
    );
    expect(roster).toContain('type: "toggleLocationFilter"');
    expect(roster).toContain('type: "togglePlatoonFilter"');
    expect(roster).toContain('type: "toggleConscriptionFilter"');
  });
});

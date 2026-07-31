import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Tablet operator workflow contract", () => {
  it("keeps distribution and search in a roster operator bar", () => {
    const bar = read("src/features/roster/components/operator-bar.tsx");

    expect(bar).toContain("max-[900px]:top-17");
    expect(bar).toContain('aria-label="Распределение по местам"');
    expect(bar).toContain('placeholder="Найти человека по ФИО, званию или номеру призыва"');
    expect(bar).toContain("min-h-11");
    expect(bar).toContain('role="alert"');
  });

  it("switches to flat, cross-platoon search results", () => {
    const roster = read("src/features/roster/components/main-content.tsx");

    expect(roster).toContain("if (state.ui.searchQuery.trim())");
    expect(roster).toContain("people={allPeople}");
    expect(roster).toContain("function SearchResults");
    expect(roster).toContain("contextLabel={platoonLabels.get(person.platoonId)}");
  });

  it("keeps quick location actions touch-sized and guarded during requests", () => {
    const people = read("src/features/roster/components/person-views.tsx");
    const app = read("src/features/roster/RosterApp.tsx");

    expect(people).toContain("min-h-11 min-w-11");
    expect(people).toContain("disabled={pending || person.location === location.key}");
    expect(people).toContain("aria-label={`Перевести ${person.name} в ${location.label}`}");
    expect(app).toContain("pendingLocationIds");
    expect(app).toContain("if (pendingLocationIds.has(person.id) || person.location === to) return;");
    expect(app).toContain("Не удалось изменить местоположение");
    expect(app).toContain("personIds");
    expect(app).toContain("applyLocationBatch");
    expect(app).toContain("patchPeopleLocations");
    expect(app).toContain("BatchConfirmDialog");
  });

  it("keeps the polished roster rail quiet and recognizable", () => {
    const topBar = read("src/features/roster/components/top-bar.tsx");
    const operatorBar = read("src/features/roster/components/operator-bar.tsx");
    const people = read("src/features/roster/components/person-views.tsx");
    const app = read("src/features/roster/RosterApp.tsx");

    expect(topBar).toContain('className="ml-auto flex shrink-0');
    expect(operatorBar).not.toContain("shadow-[0_14px_34px");
    expect(people).toContain("<MapPin");
    expect(people).not.toContain("max-[560px]:flex-wrap");
    expect(people).not.toContain("max-[460px]:order-2");
    expect(people).toContain("max-[560px]:overflow-x-auto");
    expect(people).toContain("touch-pan-x");
    expect(people).toContain("overscroll-x-contain");
    expect(app).not.toContain('aria-live="polite"');
  });

  it("does not combine equivalent text-wrapping utilities", () => {
    const people = read("src/features/roster/components/person-views.tsx");

    expect(people).not.toMatch(/wrap-anywhere\s+wrap-break-word|wrap-break-word\s+wrap-anywhere/);
  });

  it("allows the shared search control to be reused without either half", () => {
    const search = read("src/components/search-sort-control.tsx");

    expect(search).toContain("showSearch = true");
    expect(search).toContain("showSort = true");
    expect(search).toContain("{showSearch && (");
    expect(search).toContain("{shouldShowSort && (");
  });
});

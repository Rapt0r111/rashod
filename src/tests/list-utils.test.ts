import { describe, expect, it } from "vitest";
import {
  filterListItems,
  sortListItems,
  type ListSortState,
} from "@/components/list-utils";

type PersonRow = {
  name: string;
  rank: string;
  sortOrder: number;
};

const rows: PersonRow[] = [
  { name: "Петров П.П.", rank: "сержант", sortOrder: 2 },
  { name: "Андреев А.А.", rank: "сержант", sortOrder: 5 },
  { name: "Иванов И.И.", rank: "капитан", sortOrder: 3 },
  { name: "Сидоров С.С.", rank: "рядовой", sortOrder: 1 },
  { name: "Захаров З.З.", rank: "неизвестное звание", sortOrder: 4 },
  { name: "Беляев Б.Б.", rank: "неизвестное звание", sortOrder: 6 },
];

const sort = (key: ListSortState["key"], direction: ListSortState["direction"] = "asc") => ({ key, direction });

describe("shared list tools", () => {
  it("matches every search token across configured fields", () => {
    expect(filterListItems(rows, "Иванов капитан", (item) => `${item.name} ${item.rank}`)).toEqual([rows[2]]);
    expect(filterListItems(rows, "  СИДОРОВ  ", (item) => `${item.name} ${item.rank}`)).toEqual([rows[3]]);
  });

  it("sorts alphabetically with a stable tie-break", () => {
    const sorted = sortListItems(rows, sort("alpha"), {
      label: (item) => item.name,
      defaultCompare: (a, b) => a.sortOrder - b.sortOrder,
    });
    expect(sorted.map((item) => item.name)).toEqual([
      "Андреев А.А.",
      "Беляев Б.Б.",
      "Захаров З.З.",
      "Иванов И.И.",
      "Петров П.П.",
      "Сидоров С.С.",
    ]);
  });

  it("puts senior ranks first, alphabetizes equal ranks, and keeps unknown ranks last", () => {
    const sorted = sortListItems(rows, sort("rank", "desc"), {
      label: (item) => item.name,
      rank: (item) => item.rank,
      defaultCompare: (a, b) => a.sortOrder - b.sortOrder,
    });
    expect(sorted.map((item) => item.name)).toEqual([
      "Иванов И.И.",
      "Андреев А.А.",
      "Петров П.П.",
      "Сидоров С.С.",
      "Беляев Б.Б.",
      "Захаров З.З.",
    ]);
  });

  it("keeps default order unchanged", () => {
    expect(sortListItems(rows, sort("default"), {
      label: (item) => item.name,
      defaultCompare: (a, b) => a.sortOrder - b.sortOrder,
    }).map((item) => item.name)).toEqual([
      "Сидоров С.С.",
      "Петров П.П.",
      "Иванов И.И.",
      "Захаров З.З.",
      "Андреев А.А.",
      "Беляев Б.Б.",
    ]);
  });
});

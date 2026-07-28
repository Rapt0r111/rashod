export type ListSortKey = "default" | "alpha" | "rank";
export type ListSortDirection = "asc" | "desc";

export type ListSortState = {
  key: ListSortKey;
  direction: ListSortDirection;
};

export type ListSearchText<T> = (item: T) => string;

export type ListSortConfig<T> = {
  label: (item: T) => string;
  rank?: (item: T) => string;
  defaultCompare?: (a: T, b: T) => number;
};

const RANK_ORDER = [
  "рядовой",
  "ефрейтор",
  "младший сержант",
  "сержант",
  "сержант контрактной службы",
  "старший сержант",
  "прапорщик",
  "лейтенант",
  "старший лейтенант",
  "капитан",
] as const;

const rankPriorityMap: Map<string, number> = new Map(RANK_ORDER.map((rank, index) => [rank, index]));

export function normalizeListText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
}

export function filterListItems<T>(items: T[], query: string, getSearchText: ListSearchText<T>) {
  const tokens = normalizeListText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return items;

  return items.filter((item) => {
    const haystack = normalizeListText(getSearchText(item));
    return tokens.every((token) => haystack.includes(token));
  });
}

export function rankPriority(rank: string) {
  return rankPriorityMap.get(normalizeListText(rank)) ?? Number.MAX_SAFE_INTEGER;
}

function compareText(a: string, b: string) {
  return normalizeListText(a).localeCompare(normalizeListText(b), "ru-RU");
}

export function sortListItems<T>(items: T[], sort: ListSortState, config: ListSortConfig<T>) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      if (sort.key === "rank" && config.rank) {
        const leftRank = rankPriority(config.rank(left.item));
        const rightRank = rankPriority(config.rank(right.item));
        const leftUnknown = leftRank === Number.MAX_SAFE_INTEGER;
        const rightUnknown = rightRank === Number.MAX_SAFE_INTEGER;
        if (leftUnknown !== rightUnknown) {
          return leftUnknown ? 1 : -1;
        }

        const rankResult = leftRank - rightRank;
        if (rankResult !== 0) {
          return sort.direction === "desc" ? -rankResult : rankResult;
        }

        const labelResult = compareText(config.label(left.item), config.label(right.item));
        return labelResult === 0 ? left.index - right.index : labelResult;
      }

      const result = sort.key === "alpha"
        ? compareText(config.label(left.item), config.label(right.item))
        : (config.defaultCompare?.(left.item, right.item) ?? 0);
      if (result === 0) return left.index - right.index;
      return sort.direction === "desc" ? -result : result;
    })
    .map(({ item }) => item);
}

export const DEFAULT_LIST_SORT: ListSortState = { key: "default", direction: "asc" };
export const ALPHA_LIST_SORT: ListSortState = { key: "alpha", direction: "asc" };
export const RANK_LIST_SORT: ListSortState = { key: "rank", direction: "desc" };

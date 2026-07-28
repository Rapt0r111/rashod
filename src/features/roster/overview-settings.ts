import type {
  OverviewActivityMetricKey,
  OverviewBlockId,
  OverviewBlockSettings,
  OverviewDensity,
  OverviewHeroMetricKey,
  OverviewLayout,
  OverviewLocationDisplaySettings,
  OverviewSelection,
  OverviewSettings,
} from "./types";

export const OVERVIEW_BLOCKS: Array<{ id: OverviewBlockId; label: string }> = [
  { id: "hero", label: "Ключевые показатели" },
  { id: "activity", label: "Активность" },
  { id: "location-distribution", label: "Распределение по местам" },
  { id: "platoons", label: "По подразделениям" },
  { id: "location-cards", label: "Карта точек" },
  { id: "recent-activity", label: "Последние перемещения" },
];

export const OVERVIEW_HERO_METRICS: Array<{
  key: OverviewHeroMetricKey;
  label: string;
}> = [
  { key: "total", label: "Всего по списку" },
  { key: "present", label: "В расположении" },
  { key: "peakLocation", label: "Пиковая точка" },
  { key: "activeLocations", label: "Активных точек" },
];

export const OVERVIEW_ACTIVITY_METRICS: Array<{
  key: OverviewActivityMetricKey;
  label: string;
}> = [
  { key: "lastHour", label: "За час" },
  { key: "lastDay", label: "За 24 часа" },
  { key: "logTotal", label: "Всего в журнале" },
];

export const DEFAULT_OVERVIEW_SETTINGS: OverviewSettings = {
  version: 2,
  blocks: OVERVIEW_BLOCKS.map(({ id }) => defaultBlock(id)),
};

const validBlockIds = new Set<OverviewBlockId>(OVERVIEW_BLOCKS.map((item) => item.id));
const validHeroMetricKeys = new Set<OverviewHeroMetricKey>(
  OVERVIEW_HERO_METRICS.map((item) => item.key),
);
const validActivityMetricKeys = new Set<OverviewActivityMetricKey>(
  OVERVIEW_ACTIVITY_METRICS.map((item) => item.key),
);

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSettingsValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function validDensity(value: unknown): OverviewDensity {
  return value === "compact" ? "compact" : "standard";
}

function validLayout(value: unknown, fallback: OverviewLayout): OverviewLayout {
  return value === "full" || value === "half" ? value : fallback;
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function boundedInt(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function selection(value: unknown, fallback: OverviewSelection): OverviewSelection {
  const source = isRecord(value) ? value : {};
  const keys = Array.isArray(source.keys)
    ? unique(source.keys.filter((key): key is string => typeof key === "string"))
    : [...fallback.keys];
  return {
    mode: source.mode === "selected" ? "selected" : source.mode === "all" ? "all" : fallback.mode,
    keys,
  };
}

function metricKeys<T extends string>(value: unknown, valid: Set<T>, fallback: T[]) {
  const values = Array.isArray(value) ? value : [];
  const result = unique(values.filter((key): key is T => typeof key === "string" && valid.has(key as T)));
  return result.length ? result : [...fallback];
}

function locationConfig(
  value: unknown,
  fallback: OverviewLocationDisplaySettings,
  legacySelection: OverviewSelection,
): OverviewLocationDisplaySettings {
  const source = isRecord(value) ? value : {};
  return {
    locationSelection: selection(source.locationSelection, legacySelection),
    showEmpty: bool(source.showEmpty, fallback.showEmpty),
    showPercent: bool(source.showPercent, fallback.showPercent),
    expandableGroups: bool(source.expandableGroups, fallback.expandableGroups),
    showMemberCounts: bool(source.showMemberCounts, fallback.showMemberCounts),
  };
}

function defaultLocationConfig(showEmpty: boolean): OverviewLocationDisplaySettings {
  return {
    locationSelection: { mode: "all", keys: [] },
    showEmpty,
    showPercent: true,
    expandableGroups: true,
    showMemberCounts: true,
  };
}

function defaultBlock(id: OverviewBlockId): OverviewBlockSettings {
  const base = {
    visible: true,
    density: "standard" as OverviewDensity,
    layout: (id === "location-distribution" || id === "platoons" ? "half" : "full") as OverviewLayout,
  };
  switch (id) {
    case "hero":
      return { ...base, id, config: { metricKeys: OVERVIEW_HERO_METRICS.map((item) => item.key) } };
    case "activity":
      return { ...base, id, config: { metricKeys: OVERVIEW_ACTIVITY_METRICS.map((item) => item.key) } };
    case "location-distribution":
      return { ...base, id, config: defaultLocationConfig(false) };
    case "platoons":
      return { ...base, id, config: { platoonSelection: { mode: "all", keys: [] }, showEmpty: true, showPercent: true } };
    case "location-cards":
      return { ...base, id, config: defaultLocationConfig(true) };
    case "recent-activity":
      return { ...base, id, config: { limit: 10, showRelativeTime: true } };
  }
}

export function cloneDefaultOverviewSettings(): OverviewSettings {
  return {
    version: 2,
    blocks: DEFAULT_OVERVIEW_SETTINGS.blocks.map((block) => ({
      ...block,
      config: structuredClone(block.config),
    })) as OverviewBlockSettings[],
  };
}

export function normalizeOverviewSettings(value: unknown): OverviewSettings {
  const parsedValue = parseSettingsValue(value);
  const source = isRecord(parsedValue) ? parsedValue : {};
  const sourceBlocks = Array.isArray(source.blocks) ? source.blocks : [];
  const blocks: OverviewSettings["blocks"] = [];
  const seenBlocks = new Set<OverviewBlockId>();
  const legacyHeroMetricKeys = metricKeys(
    source.heroMetricKeys,
    validHeroMetricKeys,
    OVERVIEW_HERO_METRICS.map((item) => item.key),
  );
  const legacyActivityMetricKeys = metricKeys(
    source.activityMetricKeys,
    validActivityMetricKeys,
    OVERVIEW_ACTIVITY_METRICS.map((item) => item.key),
  );
  const legacyLocationSource = isRecord(source.locationSelection) ? source.locationSelection : {};
  const legacyLocationSelection = selection(legacyLocationSource, { mode: "all", keys: [] });

  for (const rawBlock of sourceBlocks) {
    if (!isRecord(rawBlock) || typeof rawBlock.id !== "string") continue;
    const id = rawBlock.id as OverviewBlockId;
    if (!validBlockIds.has(id) || seenBlocks.has(id)) continue;
    seenBlocks.add(id);
    blocks.push(normalizeBlock(rawBlock, id, legacyHeroMetricKeys, legacyActivityMetricKeys, legacyLocationSelection));
  }

  for (const defaultBlock of DEFAULT_OVERVIEW_SETTINGS.blocks) {
    if (!seenBlocks.has(defaultBlock.id)) {
      blocks.push(normalizeBlock({ id: defaultBlock.id }, defaultBlock.id, legacyHeroMetricKeys, legacyActivityMetricKeys, legacyLocationSelection));
    }
  }

  return {
    version: 2,
    blocks,
  };
}

function sameJsonValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Keeps local edits while applying remote changes that arrived after the form
 * was opened. This prevents a full-form save from silently clobbering another
 * user's setting when the roster snapshot refreshes through SSE.
 */
export function mergeOverviewSettings(
  latestValue: OverviewSettings,
  baseValue: OverviewSettings,
  localValue: OverviewSettings,
): OverviewSettings {
  const latest = normalizeOverviewSettings(latestValue);
  const base = normalizeOverviewSettings(baseValue);
  const local = normalizeOverviewSettings(localValue);
  const latestById = new Map(latest.blocks.map((block) => [block.id, block]));
  const baseById = new Map(base.blocks.map((block) => [block.id, block]));
  const localById = new Map(local.blocks.map((block) => [block.id, block]));
  const latestOrder = latest.blocks.map((block) => block.id);
  const baseOrder = base.blocks.map((block) => block.id);
  const localOrder = local.blocks.map((block) => block.id);
  const order = sameJsonValue(localOrder, baseOrder) ? latestOrder : localOrder;

  return {
    version: 2,
    blocks: order.map((id) => {
      const latestBlock = latestById.get(id);
      const baseBlock = baseById.get(id);
      const localBlock = localById.get(id);
      if (!latestBlock || !localBlock || !baseBlock) return latestBlock ?? localBlock ?? baseBlock!;

      const latestConfig = latestBlock.config as Record<string, unknown>;
      const baseConfig = baseBlock.config as Record<string, unknown>;
      const localConfig = localBlock.config as Record<string, unknown>;
      const config = { ...latestConfig };
      for (const key of new Set([...Object.keys(latestConfig), ...Object.keys(baseConfig), ...Object.keys(localConfig)])) {
        if (!sameJsonValue(localConfig[key], baseConfig[key])) config[key] = localConfig[key];
      }

      return {
        ...latestBlock,
        visible: sameJsonValue(localBlock.visible, baseBlock.visible) ? latestBlock.visible : localBlock.visible,
        density: sameJsonValue(localBlock.density, baseBlock.density) ? latestBlock.density : localBlock.density,
        layout: sameJsonValue(localBlock.layout, baseBlock.layout) ? latestBlock.layout : localBlock.layout,
        config,
      } as OverviewBlockSettings;
    }),
  };
}

function normalizeBlock(
  rawBlock: Record<string, unknown>,
  id: OverviewBlockId,
  legacyHeroMetricKeys: OverviewHeroMetricKey[],
  legacyActivityMetricKeys: OverviewActivityMetricKey[],
  legacyLocationSelection: OverviewSelection,
): OverviewBlockSettings {
  const fallback = defaultBlock(id);
  const source = isRecord(rawBlock.config) ? rawBlock.config : {};
  const layout = validLayout(rawBlock.layout, fallback.layout);
  const common = {
    visible: rawBlock.visible !== false,
    density: validDensity(rawBlock.density),
    layout,
  };
  switch (id) {
    case "hero":
      return { ...common, id, config: { metricKeys: metricKeys(source.metricKeys ?? legacyHeroMetricKeys, validHeroMetricKeys, legacyHeroMetricKeys) } };
    case "activity":
      return { ...common, id, config: { metricKeys: metricKeys(source.metricKeys ?? legacyActivityMetricKeys, validActivityMetricKeys, legacyActivityMetricKeys) } };
    case "location-distribution":
      return { ...common, id, config: locationConfig(source, defaultLocationConfig(false), selection(source.locationSelection ?? legacyLocationSelection, legacyLocationSelection)) };
    case "platoons":
      return {
        ...common,
        id,
        config: {
          platoonSelection: selection(source.platoonSelection, { mode: "all", keys: [] }),
          showEmpty: bool(source.showEmpty, true),
          showPercent: bool(source.showPercent, true),
        },
      };
    case "location-cards":
      return { ...common, id, config: locationConfig(source, defaultLocationConfig(true), selection(source.locationSelection ?? legacyLocationSelection, legacyLocationSelection)) };
    case "recent-activity":
      return {
        ...common,
        id,
        config: {
          limit: boundedInt(source.limit, 10, 1, 50),
          showRelativeTime: bool(source.showRelativeTime, true),
        },
      };
  }
}

export function overviewBlock<Id extends OverviewBlockId>(settings: OverviewSettings, id: Id) {
  return settings.blocks.find((block) => block.id === id) as Extract<OverviewBlockSettings, { id: Id }> | undefined;
}

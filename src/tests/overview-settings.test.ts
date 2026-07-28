import { describe, expect, it } from "vitest";
import {
  cloneDefaultOverviewSettings,
  mergeOverviewSettings,
  normalizeOverviewSettings,
  overviewBlock,
} from "@/features/roster/overview-settings";

describe("overview settings", () => {
  it("keeps the default block catalog while normalizing stale configuration", () => {
    const settings = normalizeOverviewSettings({
      blocks: [
        { id: "recent-activity", visible: false, density: "compact" },
        { id: "unknown", visible: true, density: "standard" },
        { id: "recent-activity", visible: true, density: "standard" },
      ],
      heroMetricKeys: ["peakLocation", "stale"],
      activityMetricKeys: ["lastHour"],
      locationSelection: { mode: "selected", keys: ["group:1", "group:1"] },
    });

    expect(settings.blocks.map((block) => block.id)).toHaveLength(6);
    expect(settings.blocks.find((block) => block.id === "recent-activity")).toEqual({
      id: "recent-activity",
      visible: false,
      density: "compact",
      layout: "full",
      config: { limit: 10, showRelativeTime: true },
    });
    expect(overviewBlock(settings, "hero")?.config.metricKeys).toEqual(["peakLocation"]);
    expect(overviewBlock(settings, "location-distribution")?.config.locationSelection).toEqual({ mode: "selected", keys: ["group:1"] });
    expect(overviewBlock(settings, "location-cards")?.config.locationSelection).toEqual({ mode: "selected", keys: ["group:1"] });
  });

  it("returns independent default objects", () => {
    const first = cloneDefaultOverviewSettings();
    const second = cloneDefaultOverviewSettings();
    first.blocks[0].visible = false;
    overviewBlock(first, "location-cards")?.config.locationSelection.keys.push("group:1");

    expect(second.blocks[0].visible).toBe(true);
    expect(overviewBlock(second, "location-cards")?.config.locationSelection.keys).toEqual([]);
  });

  it("keeps block-local content settings independent and bounded", () => {
    const settings = normalizeOverviewSettings({
      blocks: [
        { id: "hero", config: { metricKeys: ["present", "present", "unknown"] } },
        { id: "location-distribution", layout: "half", config: {
          locationSelection: { mode: "selected", keys: ["group:1", "group:1"] },
          showEmpty: false,
          showPercent: false,
          expandableGroups: false,
          showMemberCounts: false,
        } },
        { id: "location-cards", config: { locationSelection: { mode: "all", keys: [] }, showPercent: false } },
        { id: "platoons", config: { platoonSelection: { mode: "selected", keys: ["p1", "p1"] }, showEmpty: false, showPercent: false } },
        { id: "recent-activity", config: { limit: 999, showRelativeTime: false } },
      ],
    });

    expect(overviewBlock(settings, "hero")?.config.metricKeys).toEqual(["present"]);
    expect(overviewBlock(settings, "location-distribution")).toMatchObject({ layout: "half" });
    expect(overviewBlock(settings, "location-distribution")?.config).toEqual({
      locationSelection: { mode: "selected", keys: ["group:1"] },
      showEmpty: false,
      showPercent: false,
      expandableGroups: false,
      showMemberCounts: false,
    });
    expect(overviewBlock(settings, "location-cards")?.config.locationSelection).toEqual({ mode: "all", keys: [] });
    expect(overviewBlock(settings, "platoons")?.config.platoonSelection).toEqual({ mode: "selected", keys: ["p1"] });
    expect(overviewBlock(settings, "recent-activity")?.config).toEqual({ limit: 50, showRelativeTime: false });
  });

  it("merges local edits with remote settings before saving", () => {
    const base = cloneDefaultOverviewSettings();
    const latest = cloneDefaultOverviewSettings();
    latest.blocks = latest.blocks.map((block) => block.id === "hero"
      ? { ...block, visible: false }
      : block.id === "recent-activity"
        ? { ...block, config: { ...block.config, limit: 25 } }
        : block);
    const local = cloneDefaultOverviewSettings();
    local.blocks = local.blocks.map((block) => block.id === "recent-activity"
      ? { ...block, config: { ...block.config, showRelativeTime: false } }
      : block);

    const merged = mergeOverviewSettings(latest, base, local);

    expect(overviewBlock(merged, "hero")?.visible).toBe(false);
    expect(overviewBlock(merged, "recent-activity")?.config).toEqual({ limit: 25, showRelativeTime: false });
  });

  it("restores settings returned by PostgreSQL as a JSON string", () => {
    const settings = normalizeOverviewSettings(JSON.stringify({
      version: 2,
      blocks: [{ id: "hero", visible: false }],
    }));

    expect(overviewBlock(settings, "hero")?.visible).toBe(false);
  });
});

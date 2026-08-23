import { describe, expect, it } from "vitest";
import { createSeedData } from "@/server/db/seed";
import { initialUi, reducer } from "@/features/roster/state";
import {
  getRosterHistorySection,
  setRosterHistorySection,
} from "@/features/roster/navigation-history";

function testState() {
  const snapshot = createSeedData();
  return {
    ...snapshot,
    locationGroups: [],
    changeLog: [],
    serverTime: 0,
    ui: { ...initialUi },
    flashPersonId: null,
  };
}

describe("roster navigation filters", () => {
  it("stores and reads the active section without dropping framework history state", () => {
    const current = { __nextRouter: true };
    const next = setRosterHistorySection(current, "groups");

    expect(next).toMatchObject({ __nextRouter: true });
    expect(getRosterHistorySection(next)).toBe("groups");
    expect(getRosterHistorySection({})).toBeNull();
  });

  it("keeps the conscription filter in roster state and clears it on section change", () => {
    const filtered = reducer(testState(), { type: "conscriptionFilter", value: "12" });
    const changedSection = reducer(filtered, { type: "section", key: "vz1" });

    expect(filtered.ui.conscriptionFilter).toBe("12");
    expect(changedSection.ui.conscriptionFilter).toBeNull();
  });

  it("shows all raw locations included by an overview group", () => {
    const state = reducer(testState(), { type: "section", key: "all" });
    const filtered = reducer(state, { type: "locationFilters", value: ["rota", "naryad"] });

    expect(filtered.ui.activeSection).toBe("all");
    expect(filtered.ui.locationFilter).toBeNull();
    expect(filtered.ui.locationFilterKeys).toEqual(["rota", "naryad"]);
  });

  it("clears the multi-location filter when the user changes section or picks one location", () => {
    const withGroup = reducer(testState(), { type: "locationFilters", value: ["rota", "naryad"] });
    const inPlatoon = reducer(withGroup, { type: "section", key: "vz1" });
    const oneLocation = reducer(withGroup, { type: "locationFilter", value: "rota" });

    expect(inPlatoon.ui.locationFilterKeys).toBeNull();
    expect(oneLocation.ui.locationFilterKeys).toBeNull();
    expect(oneLocation.ui.locationFilter).toBe("rota");
  });

  it("toggles multiple filter values and removes them on repeated click", () => {
    const withFirst = reducer(testState(), {
      type: "toggleLocationFilter",
      value: "rota",
    });
    const withTwo = reducer(withFirst, {
      type: "toggleLocationFilter",
      value: "naryad",
    });
    const withoutFirst = reducer(withTwo, {
      type: "toggleLocationFilter",
      value: "rota",
    });
    const cleared = reducer(withoutFirst, {
      type: "toggleLocationFilter",
      value: "naryad",
    });

    expect(withTwo.ui.locationFilterKeys).toEqual(["rota", "naryad"]);
    expect(withTwo.ui.locationFilter).toBeNull();
    expect(withoutFirst.ui.locationFilterKeys).toEqual(["naryad"]);
    expect(withoutFirst.ui.locationFilter).toBe("naryad");
    expect(cleared.ui.locationFilterKeys).toBeNull();
    expect(cleared.ui.locationFilter).toBeNull();
  });

  it("supports several platoons and conscription numbers at once", () => {
    const withPlatoons = reducer(
      reducer(testState(), { type: "togglePlatoonFilter", value: "vz1" }),
      { type: "togglePlatoonFilter", value: "vz2" },
    );
    const withConscription = reducer(
      reducer(withPlatoons, { type: "toggleConscriptionFilter", value: "12" }),
      { type: "toggleConscriptionFilter", value: "13" },
    );

    expect(withConscription.ui.platoonFilterKeys).toEqual(["vz1", "vz2"]);
    expect(withConscription.ui.platoonFilter).toBeNull();
    expect(withConscription.ui.conscriptionFilterKeys).toEqual(["12", "13"]);
    expect(withConscription.ui.conscriptionFilter).toBeNull();
  });

  it("toggles rank and platoon columns without resetting them on section change", () => {
    const hiddenRank = reducer(testState(), { type: "toggleRosterColumn", column: "rank" });
    const shownPlatoon = reducer(hiddenRank, { type: "toggleRosterColumn", column: "platoon" });
    const changedSection = reducer(shownPlatoon, { type: "section", key: "vz1" });

    expect(initialUi.showRankColumn).toBe(true);
    expect(initialUi.showPlatoonColumn).toBe(false);
    expect(hiddenRank.ui.showRankColumn).toBe(false);
    expect(shownPlatoon.ui.showPlatoonColumn).toBe(true);
    expect(changedSection.ui.showRankColumn).toBe(false);
    expect(changedSection.ui.showPlatoonColumn).toBe(true);
  });
});

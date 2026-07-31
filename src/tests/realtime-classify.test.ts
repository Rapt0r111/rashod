import { describe, expect, it } from "vitest";
import {
  classifyRealtimeReason,
  mergeRealtimeReasons,
} from "@/features/realtime/RealtimeProvider";

describe("classifyRealtimeReason", () => {
  it("maps known roster mutation reasons", () => {
    expect(classifyRealtimeReason("location-change")).toBe("roster");
    expect(classifyRealtimeReason("people")).toBe("roster");
    expect(classifyRealtimeReason("overview-settings")).toBe("roster");
  });

  it("maps groups and tasks domains", () => {
    expect(classifyRealtimeReason("groups")).toBe("groups");
    expect(classifyRealtimeReason("groups-refresh")).toBe("groups");
    expect(classifyRealtimeReason("tasks")).toBe("tasks");
  });

  it("treats empty or unknown reasons as unknown so all domains refresh", () => {
    expect(classifyRealtimeReason("")).toBe("unknown");
    expect(classifyRealtimeReason("future-event")).toBe("unknown");
  });
});

describe("mergeRealtimeReasons", () => {
  it("unions same-window reasons so people is not dropped by location-change", () => {
    expect(mergeRealtimeReasons("people", "location-change")).toBe(
      "people,location-change",
    );
    expect(mergeRealtimeReasons("location-change", "people")).toBe(
      "location-change,people",
    );
    expect(mergeRealtimeReasons("people,location-change", "people")).toBe(
      "people,location-change",
    );
    expect(mergeRealtimeReasons("", "people")).toBe("people");
  });
});

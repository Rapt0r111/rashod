import { fetchJson } from "@/lib/api-client";
import { defaultScheduleRange } from "./logic";
import type { ScheduleSnapshot } from "./types";

export function fetchScheduleSnapshot(from?: string, to?: string) {
  const fallback = defaultScheduleRange();
  const params = new URLSearchParams({
    from: from ?? fallback.from,
    to: to ?? fallback.to,
  });
  return fetchJson<ScheduleSnapshot>(`/api/schedule?${params.toString()}`);
}

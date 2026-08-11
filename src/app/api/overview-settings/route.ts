import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getPostgresOverviewSettings,
  upsertPostgresOverviewSettings,
} from "@/server/db/postgres-roster-repository";
import { publishRosterChanged } from "@/server/events";
import { requirePermission } from "@/server/auth";
import { normalizeOverviewSettings } from "@/features/roster/overview-settings";
import { apiError, parseJson, runAuditedMutation, uniqueArray, uniqueArrayBy } from "@/server/http";
import { liveJson } from "@/server/cache/http";

const blockIds = [
  "hero",
  "activity",
  "location-distribution",
  "platoons",
  "location-cards",
  "recent-activity",
] as const;
const heroMetricKeys = ["total", "present", "peakLocation", "activeLocations"] as const;
const activityMetricKeys = ["lastHour", "lastDay", "logTotal"] as const;

const overviewBlockSchema = z.looseObject({
  id: z.enum(blockIds),
  visible: z.boolean().optional(),
  density: z.enum(["standard", "compact"]).optional(),
  layout: z.enum(["full", "half"]).optional(),
  config: z.unknown().optional(),
});

const overviewSettingsSchema = z.looseObject({
  version: z.number().int().min(1).max(10).optional(),
  blocks: uniqueArrayBy(overviewBlockSchema, (block) => block.id, blockIds.length),
  heroMetricKeys: uniqueArray(z.enum(heroMetricKeys), heroMetricKeys.length).optional(),
  activityMetricKeys: uniqueArray(z.enum(activityMetricKeys), activityMetricKeys.length).optional(),
  locationSelection: z.unknown().optional(),
});


export async function GET(request: Request) {
  const auth = await requirePermission(request, "roster:read");
  if (auth instanceof NextResponse) return auth;
  return liveJson(await getPostgresOverviewSettings());
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, "references:manage");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = normalizeOverviewSettings(await parseJson(request, overviewSettingsSchema));
    const snapshot = await runAuditedMutation(
      auth,
      "reference.overview_settings.saved",
      () => upsertPostgresOverviewSettings(input),
    );
    publishRosterChanged("overview-settings");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}

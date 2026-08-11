import { NextResponse } from "next/server";
import { requirePermission } from "@/server/auth";
import { searchPeopleForZgt } from "@/server/db/postgres-zgt-repository";
import { liveJson } from "@/server/cache/http";


export async function GET(request: Request) {
  const auth = await requirePermission(request, "zgt:read");
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const items = await searchPeopleForZgt(q, Number.isFinite(limit) ? limit : 20);
  return liveJson({ items });
}

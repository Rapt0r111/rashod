import { NextResponse } from "next/server";
import { getAuthContext } from "@/server/auth";

export async function GET(request: Request) {
  const context = await getAuthContext(request);
  if (!context) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  return NextResponse.json(context, { headers: { "Cache-Control": "no-store" } });
}

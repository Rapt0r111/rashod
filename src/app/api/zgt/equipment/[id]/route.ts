import { NextResponse } from "next/server";
import { requirePermission } from "@/server/auth";
import { getEquipmentById } from "@/server/db/postgres-zgt-repository";
import { apiError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission(request, "zgt:read");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await context.params;
    const item = await getEquipmentById(id);
    if (!item) return NextResponse.json({ error: "EQUIPMENT_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ item }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

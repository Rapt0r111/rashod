import { NextResponse } from "next/server";
import { requirePermission } from "@/server/auth";
import { getEquipmentById } from "@/server/db/postgres-zgt-repository";
import { apiError } from "@/server/http";
import { liveJson } from "@/server/cache/http";


export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission(request, "zgt:read");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await context.params;
    const item = await getEquipmentById(id);
    if (!item) return liveJson({ error: "EQUIPMENT_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error);
  }
}

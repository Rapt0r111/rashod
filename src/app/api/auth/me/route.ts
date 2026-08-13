import { getAuthContext } from "@/server/auth";
import { liveJson } from "@/server/cache/http";

export async function GET(request: Request) {
  const context = await getAuthContext(request);
  if (!context) return liveJson({ error: "AUTH_REQUIRED" }, { status: 401 });
  return liveJson(context);
}

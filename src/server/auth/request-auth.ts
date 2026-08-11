import { cache } from "react";
import { cookies } from "next/headers";
import { getAuthContextByToken } from "@/server/auth";

/**
 * Per-request auth lookup shared by layout + page (React cache).
 * Avoids a second DB/session hit when shell layout and page both need the user.
 */
export const getRequestAuth = cache(async () => {
  const token = (await cookies()).get("rashod_session")?.value;
  return getAuthContextByToken(token);
});

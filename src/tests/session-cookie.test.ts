import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureSessionCookie } from "@/server/auth/session-cookie";

describe("session cookie transport", () => {
  it("keeps production sessions secure by default", () => {
    expect(isSecureSessionCookie({ NODE_ENV: "production" })).toBe(true);
  });

  it("allows the explicit LAN HTTP mode", () => {
    expect(
      isSecureSessionCookie({
        NODE_ENV: "production",
        AUTH_ALLOW_INSECURE_LAN: "true",
      }),
    ).toBe(false);
  });

  it("never adds Secure to development sessions", () => {
    expect(isSecureSessionCookie({ NODE_ENV: "development" })).toBe(false);
  });

  it("sends /api/auth/me as a private no-store payload", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/auth/me/route.ts"), "utf8");
    expect(source).toContain("return liveJson(context)");
    expect(source).not.toContain("NextResponse.json(context)");
  });
});

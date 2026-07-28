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
});

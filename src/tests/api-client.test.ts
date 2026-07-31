import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, fetchJson, getApiErrorMessage } from "@/lib/api-client";

describe("api-client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(fetchJson<{ ok: boolean }>("/api/health")).resolves.toEqual({
      ok: true,
    });
  });

  it("throws ApiError with server code on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "GROUP_NOT_FOUND" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(fetchJson("/api/groups")).rejects.toMatchObject({
      name: "ApiError",
      message: "GROUP_NOT_FOUND",
      status: 404,
    });
  });

  it("maps API errors to Russian operator messages", () => {
    expect(getApiErrorMessage(new ApiError("CONFLICT", 409), "fail")).toContain(
      "изменились",
    );
    expect(getApiErrorMessage(new ApiError("FORBIDDEN", 403), "fail")).toContain(
      "прав",
    );
    expect(getApiErrorMessage(new Error("network"), "Операция не выполнена")).toContain(
      "соединение",
    );
  });

  it(
    "redirects on 401, hangs briefly, then rejects if navigation stalls",
    async () => {
      const assign = vi.fn();
      vi.stubGlobal("window", { location: { assign } });
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      const pending = fetchJson("/api/snapshot");
      // Attach early so the 2s fallback reject is never unhandled.
      const settled = pending.then(
        () => "resolved" as const,
        (error: unknown) => error,
      );

      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(assign).toHaveBeenCalledWith("/");

      // Still hanging before the ~2s navigation fallback.
      await expect(
        Promise.race([
          settled.then(() => "settled"),
          new Promise((resolve) => setTimeout(() => resolve("hang"), 50)),
        ]),
      ).resolves.toBe("hang");

      await expect(pending).rejects.toMatchObject({
        name: "ApiError",
        message: "AUTH_REQUIRED",
        status: 401,
      });
    },
    5000,
  );
});

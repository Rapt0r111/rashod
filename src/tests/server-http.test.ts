import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiError, parseJson } from "@/server/http";

const json = (body: string, contentType = "application/json") =>
  new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });

describe("server HTTP contract", () => {
  it("parses bounded JSON through Zod", async () => {
    await expect(parseJson(
      json('{"name":"  Иван  "}', "application/json; charset=utf-8"),
      z.object({ name: z.string().trim() }),
    )).resolves.toEqual({ name: "Иван" });
  });

  it("accepts structured JSON media types", async () => {
    await expect(parseJson(
      json('{"ok":true}', "application/problem+json; charset=utf-8"),
      z.object({ ok: z.boolean() }),
    )).resolves.toEqual({ ok: true });
  });

  it.each([
    [json("{}", "text/plain"), 415, "UNSUPPORTED_MEDIA_TYPE"],
    [json("{"), 400, "BAD_REQUEST"],
    [json(""), 400, "BAD_REQUEST"],
    [json(JSON.stringify({ value: "large" })), 413, "PAYLOAD_TOO_LARGE"],
  ] as const)("rejects invalid request boundaries", async (request, status, code) => {
    let caught: unknown;
    try {
      await parseJson(request, z.unknown(), code === "PAYLOAD_TOO_LARGE" ? { maxBytes: 3 } : undefined);
    } catch (error) {
      caught = error;
    }
    const response = apiError(caught);
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: code });
  });

  it("rejects a declared body larger than the configured limit", async () => {
    const request = json("{}");
    request.headers.set("content-length", "65");
    let caught: unknown;
    try {
      await parseJson(request, z.unknown(), { maxBytes: 64 });
    } catch (error) {
      caught = error;
    }
    const response = apiError(caught);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "PAYLOAD_TOO_LARGE" });
  });

  it.each([
    ["LOCATION_NOT_FOUND", 404],
    ["GROUP_ASSIGNMENT_INELIGIBLE", 409],
    ["PAYLOAD_TOO_LARGE", 413],
  ])("maps %s", async (code, status) => {
    expect(apiError(new Error(code)).status).toBe(status);
  });

  it("does not expose unexpected server errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = apiError(new Error("postgres secret"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "INTERNAL_ERROR" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

import { describe, expect, it } from "vitest";
import { loggedFetch, redactEndpoint, type ApiLogEntry } from "./logged-fetch";

describe("loggedFetch", () => {
  it("logs status, duration and a redacted endpoint", async () => {
    const logs: ApiLogEntry[] = [];
    const fakeFetch = (async () => new Response("{}", { status: 429, statusText: "Too Many Requests" })) as typeof fetch;
    const res = await loggedFetch(
      async (e) => void logs.push(e),
      { platform: "instagram_graph", orgId: "o", brandId: "b" },
      "https://graph.facebook.com/v99.0/123/tags?access_token=SECRET",
      { method: "get" },
      fakeFetch,
    );
    expect(res.status).toBe(429);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      platform: "instagram_graph",
      org_id: "o",
      brand_id: "b",
      endpoint: "https://graph.facebook.com/v99.0/123/tags",
      method: "GET",
      status_code: 429,
      error: "HTTP 429 Too Many Requests",
    });
    expect(JSON.stringify(logs)).not.toContain("SECRET");
  });

  it("logs network errors and rethrows them", async () => {
    const logs: ApiLogEntry[] = [];
    const failing = (async () => {
      throw new Error("ECONNRESET");
    }) as typeof fetch;
    await expect(loggedFetch(async (e) => void logs.push(e), { platform: "x" }, "https://x.test/a", undefined, failing)).rejects.toThrow(
      "ECONNRESET",
    );
    expect(logs[0]).toMatchObject({ status_code: null, error: "ECONNRESET" });
  });

  it("never fails the request because logging failed", async () => {
    const ok = (async () => new Response("ok")) as typeof fetch;
    const res = await loggedFetch(async () => Promise.reject(new Error("db down")), { platform: "x" }, "https://x.test", undefined, ok);
    expect(res.status).toBe(200);
  });

  it("redacts query strings", () => {
    expect(redactEndpoint("https://a.test/p?token=1")).toBe("https://a.test/p");
  });
});

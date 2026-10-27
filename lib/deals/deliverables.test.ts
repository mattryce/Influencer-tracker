import { describe, expect, it } from "vitest";
import { formatDeliverables, parseDeliverables, totalDeliverables } from "./deliverables";

describe("parseDeliverables", () => {
  it("parses the format the team uses today", () => {
    const r = parseDeliverables("2 Reels + 3 Stories");
    expect(r).toEqual({
      ok: true,
      deliverables: [
        { platform: "instagram", type: "reel", count: 2 },
        { platform: "instagram", type: "story", count: 3 },
      ],
    });
  });

  it("handles mixed platforms, commas, 'and', implicit 1 and merges duplicates", () => {
    const r = parseDeliverables("1 TikTok, 1 YouTube video and Story + 2 stories");
    expect(r.ok && r.deliverables).toEqual([
      { platform: "tiktok", type: "video", count: 1 },
      { platform: "youtube", type: "video", count: 1 },
      { platform: "instagram", type: "story", count: 3 },
    ]);
  });

  it("recognises shorts and feed posts", () => {
    const r = parseDeliverables("2x YT Shorts; 1 IG post");
    expect(r.ok && r.deliverables).toEqual([
      { platform: "youtube", type: "short", count: 2 },
      { platform: "instagram", type: "post", count: 1 },
    ]);
  });

  it("returns empty for blank input", () => {
    expect(parseDeliverables("  ")).toEqual({ ok: true, deliverables: [] });
  });

  it("explains what it couldn't parse", () => {
    const r = parseDeliverables("2 Reels + 1 podcast");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/podcast/);
  });
});

describe("formatDeliverables", () => {
  it("round-trips to readable text", () => {
    const r = parseDeliverables("2 reels + 1 story + 1 tiktok");
    expect(r.ok && formatDeliverables(r.deliverables)).toBe("2 Instagram Reels + 1 Instagram Story + 1 TikTok");
    expect(r.ok && totalDeliverables(r.deliverables)).toBe(4);
  });
});

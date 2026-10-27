import { describe, expect, it } from "vitest";
import { normalizeHandle, normalizeTagList } from "./handles";

describe("normalizeHandle", () => {
  it.each([
    ["instagram", "@JakeTorque", "jaketorque"],
    ["instagram", "jake.torque_", "jake.torque_"],
    ["instagram", "https://www.instagram.com/JakeTorque/?igsh=abc", "jaketorque"],
    ["instagram", "instagram.com/jaketorque", "jaketorque"],
    ["tiktok", "https://www.tiktok.com/@Tina.Tunes?lang=en", "tina.tunes"],
    ["tiktok", "@tina_tunes", "tina_tunes"],
    ["youtube", "https://youtube.com/@RosaBuilds", "rosabuilds"],
    ["youtube", "@rosa-builds", "rosa-builds"],
    ["youtube", "m.youtube.com/@rosa/videos", "rosa"],
  ] as const)("%s %s -> %s", (platform, input, expected) => {
    const r = normalizeHandle(platform, input);
    expect(r).toMatchObject({ ok: true, handle: expected });
  });

  it("builds profile URLs", () => {
    expect(normalizeHandle("tiktok", "x_y")).toEqual({ ok: true, handle: "x_y", profileUrl: "https://www.tiktok.com/@x_y" });
  });

  it.each([
    ["instagram", "", /empty/],
    ["instagram", "has space", /valid instagram handle/],
    ["instagram", "https://www.instagram.com/p/C123abc/", /post link/],
    ["instagram", "https://tiktok.com/@abc", /not a instagram link/],
    ["youtube", "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw", /@handle/],
    ["tiktok", "a", /valid tiktok handle/],
  ] as const)("rejects %s %j", (platform, input, msg) => {
    const r = normalizeHandle(platform, input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(msg);
  });
});

describe("normalizeTagList", () => {
  it("splits, strips prefixes, lowercases and dedupes", () => {
    expect(normalizeTagList("#HotShot, #hotshot  #Diesel", "#")).toEqual(["hotshot", "diesel"]);
    expect(normalizeTagList("@HotShotSecret", "@")).toEqual(["hotshotsecret"]);
    expect(normalizeTagList("", "#")).toEqual([]);
  });
});

import type { Platform } from "@/lib/types";

export type HandleResult = { ok: true; handle: string; profileUrl: string } | { ok: false; error: string };

const RULES: Record<Platform, { pattern: RegExp; hosts: string[]; describe: string }> = {
  instagram: { pattern: /^[a-z0-9._]{1,30}$/, hosts: ["instagram.com"], describe: "letters, numbers, . and _ (max 30)" },
  tiktok: { pattern: /^[a-z0-9._]{2,24}$/, hosts: ["tiktok.com"], describe: "letters, numbers, . and _ (2–24)" },
  youtube: { pattern: /^[a-z0-9._-]{3,30}$/, hosts: ["youtube.com", "youtu.be"], describe: "letters, numbers, . _ and - (3–30)" },
};

export function profileUrl(platform: Platform, handle: string): string {
  switch (platform) {
    case "instagram":
      return `https://www.instagram.com/${handle}/`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "youtube":
      return `https://www.youtube.com/@${handle}`;
  }
}

/**
 * Turn whatever the team pasted (a handle, @handle, or a profile URL) into the normalized
 * handle we store: lowercase, no leading @. Dedupe relies on this being consistent.
 */
export function normalizeHandle(platform: Platform, raw: string): HandleResult {
  let value = raw.trim();
  if (!value) return { ok: false, error: "Handle is empty" };

  if (/^(https?:\/\/)?([a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}\//i.test(value) || /^https?:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
      return { ok: false, error: `"${raw}" is not a valid URL` };
    }
    const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
    const rule = RULES[platform];
    if (!rule.hosts.includes(host)) {
      return { ok: false, error: `"${raw}" is not a ${platform} link` };
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (platform === "youtube" && segments[0] && !segments[0].startsWith("@")) {
      return {
        ok: false,
        error: `YouTube link "${raw}" doesn't contain an @handle. Open the channel and copy the youtube.com/@handle link instead.`,
      };
    }
    if (platform === "tiktok" && segments[0] && !segments[0].startsWith("@")) {
      return { ok: false, error: `TikTok link "${raw}" doesn't contain an @handle` };
    }
    if (platform === "instagram" && ["p", "reel", "reels", "stories", "tv", "explore"].includes(segments[0] ?? "")) {
      return { ok: false, error: `"${raw}" is a post link, not a profile link` };
    }
    value = segments[0] ?? "";
  }

  const handle = value.replace(/^@+/, "").toLowerCase();
  const rule = RULES[platform];
  if (!rule.pattern.test(handle)) {
    return { ok: false, error: `"${raw}" isn't a valid ${platform} handle — ${rule.describe}` };
  }
  return { ok: true, handle, profileUrl: profileUrl(platform, handle) };
}

/** Normalize a hashtag or @mention list typed as "#a, #b c" into ["a","b","c"]. */
export function normalizeTagList(raw: string | null | undefined, prefix: "#" | "@"): string[] {
  if (!raw) return [];
  const out = raw
    .split(/[\s,]+/)
    .map((t) => t.trim().replace(new RegExp(`^\\${prefix}+`), "").toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(out));
}

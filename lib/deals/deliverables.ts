import type { Deliverable, Platform } from "@/lib/types";

// Words people actually type in deal notes, mapped to a platform + deliverable type.
const SYNONYMS: Array<{ match: RegExp; platform: Platform | null; type: string }> = [
  { match: /^(ig\s*|instagram\s*)?reels?$/, platform: "instagram", type: "reel" },
  { match: /^(ig\s*|instagram\s*)?stor(y|ies)$/, platform: "instagram", type: "story" },
  { match: /^(ig\s*|instagram\s*)(feed\s*)?posts?$|^feed\s*posts?$|^carousels?$/, platform: "instagram", type: "post" },
  { match: /^tik\s*toks?$|^tiktok\s*videos?$/, platform: "tiktok", type: "video" },
  { match: /^(youtube|yt)\s*shorts?$|^shorts?$/, platform: "youtube", type: "short" },
  { match: /^(youtube|yt)\s*(videos?|integrations?)?$|^(dedicated\s*)?videos?$/, platform: "youtube", type: "video" },
  { match: /^posts?$/, platform: null, type: "post" },
];

const TYPE_LABELS: Record<string, [string, string]> = {
  "instagram:reel": ["Instagram Reel", "Instagram Reels"],
  "instagram:story": ["Instagram Story", "Instagram Stories"],
  "instagram:post": ["Instagram post", "Instagram posts"],
  "tiktok:video": ["TikTok", "TikToks"],
  "youtube:video": ["YouTube video", "YouTube videos"],
  "youtube:short": ["YouTube Short", "YouTube Shorts"],
};

export type ParseResult = { ok: true; deliverables: Deliverable[] } | { ok: false; error: string };

/** Parse "2 Reels + 3 Stories, 1 TikTok" into structured deliverables. */
export function parseDeliverables(input: string): ParseResult {
  const text = input.trim();
  if (!text) return { ok: true, deliverables: [] };
  const parts = text.split(/\s*(?:\+|,|;|&|\band\b|\n)\s*/i).filter(Boolean);
  const merged = new Map<string, Deliverable>();

  for (const part of parts) {
    const m = part.trim().match(/^(\d+)\s*x?\s+(.+)$/i) ?? part.trim().match(/^()(.+)$/);
    const count = m && m[1] ? parseInt(m[1], 10) : 1;
    const noun = (m?.[2] ?? "").trim().toLowerCase().replace(/[.!]+$/, "");
    const syn = SYNONYMS.find((s) => s.match.test(noun));
    if (!syn) {
      return {
        ok: false,
        error: `Didn't recognise "${part.trim()}". Try e.g. "2 Reels + 3 Stories", "1 TikTok", "1 YouTube video".`,
      };
    }
    if (count < 1 || count > 100) return { ok: false, error: `"${part.trim()}": count must be between 1 and 100` };
    const key = `${syn.platform ?? "any"}:${syn.type}`;
    const prev = merged.get(key);
    merged.set(key, { platform: syn.platform, type: syn.type, count: (prev?.count ?? 0) + count });
  }
  return { ok: true, deliverables: Array.from(merged.values()) };
}

export function formatDeliverable(d: Deliverable): string {
  const labels = TYPE_LABELS[`${d.platform}:${d.type}`] ?? [d.type, `${d.type}s`];
  return `${d.count} ${d.count === 1 ? labels[0] : labels[1]}`;
}

export function formatDeliverables(list: Deliverable[] | null | undefined): string {
  if (!list || list.length === 0) return "";
  return list.map(formatDeliverable).join(" + ");
}

export function totalDeliverables(list: Deliverable[] | null | undefined): number {
  return (list ?? []).reduce((n, d) => n + d.count, 0);
}

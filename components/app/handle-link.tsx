import { PLATFORM_LABELS, type Platform } from "@/lib/types";
import { profileUrl } from "@/lib/creators/handles";

const SHORT: Record<Platform, string> = { instagram: "IG", tiktok: "TT", youtube: "YT" };

export function HandleLink({ platform, handle, long = false }: { platform: Platform; handle: string; long?: boolean }) {
  return (
    <a
      href={profileUrl(platform, handle)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs hover:bg-accent"
      title={`${PLATFORM_LABELS[platform]}: @${handle}`}
    >
      <span className="font-semibold text-muted-foreground">{long ? PLATFORM_LABELS[platform] : SHORT[platform]}</span>@{handle}
    </a>
  );
}

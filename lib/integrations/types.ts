import type { HealthStatus, MetricSource, Platform } from "@/lib/types";

/**
 * Every value an integration returns is either a real number with provenance, or an explicit
 * "not available" with a human-readable reason. There is no way to return a silent 0.
 */
export type Metric<T = number> =
  | { available: true; value: T; source: MetricSource; fetchedAt: string }
  | { available: false; reason: string };

export const notAvailable = (reason: string): Metric<never> => ({ available: false, reason });

export interface CreatorProfile {
  platform: Platform;
  handle: string;
  platformUserId: string | null;
  displayName: string | null;
  followers: Metric;
}

export interface PostMetrics {
  views: Metric;
  reach: Metric;
  impressions: Metric;
  likes: Metric;
  comments: Metric;
  shares: Metric;
  saves: Metric;
  watchTimeSeconds: Metric;
}

export interface Mention {
  platform: Platform;
  platformPostId: string;
  url: string | null;
  authorHandle: string | null;
  mediaType: string | null;
  caption: string | null;
  postedAt: string | null;
  mediaUrl: string | null;
  captureSource: string;
}

export interface HealthReport {
  status: HealthStatus;
  checkedAt: string;
  lastError: string | null;
  tokenExpiresAt: string | null;
}

/** Scope an adapter call runs under, used for logging and health records. */
export interface IntegrationContext {
  orgId: string;
  brandId?: string | null;
  creatorAccountId?: string | null;
}

/**
 * Common interface for every third-party platform (CLAUDE.md). One adapter failing must never
 * throw through to the page — callers get Metric/HealthReport values they can display.
 */
export interface IntegrationAdapter {
  readonly integration: string;
  fetchCreatorProfile(ctx: IntegrationContext, handle: string): Promise<CreatorProfile | null>;
  fetchPostMetrics(ctx: IntegrationContext, postRef: { url: string; platformPostId?: string | null }): Promise<PostMetrics>;
  listNewMentions(ctx: IntegrationContext, since: Date): Promise<Mention[]>;
  health(ctx: IntegrationContext): Promise<HealthReport>;
}

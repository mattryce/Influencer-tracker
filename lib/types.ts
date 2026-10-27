export const PLATFORMS = ["instagram", "tiktok", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export type OrgRole = "admin" | "member";
export type BrandRole = "editor" | "viewer";

export type MetricSource = "creator_oauth" | "brand_graph_api" | "public_api" | "screenshot_ocr" | "manual";

export type HealthStatus = "not_connected" | "connected" | "token_expiring" | "broken" | "rate_limited";

export interface Brand {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  website_url: string | null;
  shopify_store_domain: string | null;
  instagram_business_account_id: string | null;
  instagram_username: string | null;
}

export interface Creator {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[];
  rate_card: Record<string, number>;
}

export interface CreatorAccount {
  id: string;
  creator_id: string;
  platform: Platform;
  handle: string;
  profile_url: string | null;
  oauth_status: string;
}

export interface Campaign {
  id: string;
  brand_id: string;
  name: string;
  status: "draft" | "active" | "completed" | "archived";
  starts_on: string | null;
  ends_on: string | null;
  budget: string | null;
  goal: string | null;
  required_hashtags: string[];
  required_mentions: string[];
}

export interface Deliverable {
  platform: Platform | null;
  type: string;
  count: number;
}

export interface Deal {
  id: string;
  campaign_id: string;
  brand_id: string;
  creator_id: string;
  status: "proposed" | "active" | "completed" | "cancelled";
  fee: string;
  product_value: string;
  deliverables: Deliverable[];
  due_date: string | null;
  discount_code: string | null;
  utm_tag: string | null;
  create_shopify_discount: boolean;
  shopify_discount_status: "not_requested" | "pending" | "created" | "failed";
  shopify_discount_error: string | null;
  usage_rights: boolean;
  notes: string | null;
}

export interface IntegrationHealth {
  id: string;
  integration: string;
  brand_id: string | null;
  status: HealthStatus;
  last_success_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  token_expires_at: string | null;
}

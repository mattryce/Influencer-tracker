import { normalizeTagList } from "@/lib/creators/handles";
import { parseDeliverables } from "@/lib/deals/deliverables";
import type { Deliverable } from "@/lib/types";

export interface CampaignInput {
  brand_id: string;
  name: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  budget: number | null;
  goal: string | null;
  required_hashtags: string[];
  required_mentions: string[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CAMPAIGN_STATUSES = ["draft", "active", "completed", "archived"];

export function validateCampaign(raw: Record<string, string>): { value?: CampaignInput; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const name = (raw.name ?? "").trim();
  if (!name) fieldErrors.name = "Campaign name is required.";
  if (!raw.brand_id) fieldErrors.brand_id = "Pick a brand.";
  const status = CAMPAIGN_STATUSES.includes(raw.status) ? raw.status : "draft";
  const starts = raw.starts_on?.trim() || null;
  const ends = raw.ends_on?.trim() || null;
  if (starts && !DATE.test(starts)) fieldErrors.starts_on = "Use a valid date.";
  if (ends && !DATE.test(ends)) fieldErrors.ends_on = "Use a valid date.";
  if (starts && ends && ends < starts) fieldErrors.ends_on = "End date is before the start date.";
  const budgetRaw = (raw.budget ?? "").replace(/[$,\s]/g, "");
  const budget = budgetRaw ? Number(budgetRaw) : null;
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) fieldErrors.budget = "Enter an amount like 5000.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  return {
    fieldErrors,
    value: {
      brand_id: raw.brand_id,
      name,
      status,
      starts_on: starts,
      ends_on: ends,
      budget,
      goal: raw.goal?.trim() || null,
      required_hashtags: normalizeTagList(raw.required_hashtags, "#"),
      required_mentions: normalizeTagList(raw.required_mentions, "@"),
    },
  };
}

export interface DealInput {
  creator_id: string;
  status: string;
  fee: number;
  product_value: number;
  deliverables: Deliverable[];
  due_date: string | null;
  discount_code: string | null;
  utm_tag: string | null;
  create_shopify_discount: boolean;
  usage_rights: boolean;
  notes: string | null;
}

const DEAL_STATUSES = ["proposed", "active", "completed", "cancelled"];

function amount(v: string | undefined): number | null | typeof NaN {
  const s = (v ?? "").replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

export function validateDeal(raw: Record<string, string>): { value?: DealInput; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  if (!raw.creator_id) fieldErrors.creator_id = "Pick a creator.";
  const fee = amount(raw.fee);
  if (Number.isNaN(fee)) fieldErrors.fee = "Enter an amount like 750.";
  const productValue = amount(raw.product_value);
  if (Number.isNaN(productValue)) fieldErrors.product_value = "Enter an amount like 120.";
  const parsed = parseDeliverables(raw.deliverables ?? "");
  if (!parsed.ok) fieldErrors.deliverables = parsed.error;
  const due = raw.due_date?.trim() || null;
  if (due && !DATE.test(due)) fieldErrors.due_date = "Use a valid date.";

  const code = (raw.discount_code ?? "").trim().toUpperCase() || null;
  if (code && !/^[A-Z0-9_-]{3,40}$/.test(code)) fieldErrors.discount_code = "3–40 letters, numbers, - or _ (no spaces).";
  const utm = (raw.utm_tag ?? "").trim().toLowerCase() || null;
  if (utm && !/^[a-z0-9_-]{2,60}$/.test(utm)) fieldErrors.utm_tag = "Lowercase letters, numbers, - or _ (no spaces).";
  const createDiscount = raw.create_shopify_discount === "on";
  if (createDiscount && !code) fieldErrors.discount_code = "Enter the code to create in Shopify.";

  if (Object.keys(fieldErrors).length) return { fieldErrors };
  return {
    fieldErrors,
    value: {
      creator_id: raw.creator_id,
      status: DEAL_STATUSES.includes(raw.status) ? raw.status : "proposed",
      fee: (fee as number | null) ?? 0,
      product_value: (productValue as number | null) ?? 0,
      deliverables: parsed.ok ? parsed.deliverables : [],
      due_date: due,
      discount_code: code,
      utm_tag: utm,
      create_shopify_discount: createDiscount,
      usage_rights: raw.usage_rights === "on",
      notes: raw.notes?.trim() || null,
    },
  };
}

export function formToRecord(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { friendlyDbError, type FormState } from "@/lib/forms";
import { formToRecord, validateCampaign, validateDeal } from "@/lib/campaigns/validate";

export async function createCampaign(_prev: FormState, form: FormData): Promise<FormState> {
  await requireSession();
  const { value, fieldErrors } = validateCampaign(formToRecord(form));
  if (!value) return { fieldErrors };
  const supabase = await createClient();
  const { data, error } = await supabase.from("campaigns").insert(value).select("id").single();
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/campaigns");
  redirect(`/campaigns/${data.id}`);
}

export async function updateCampaign(campaignId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireSession();
  const { value, fieldErrors } = validateCampaign(formToRecord(form));
  if (!value) return { fieldErrors };
  const supabase = await createClient();
  // brand_id is fixed once a campaign exists (deals and attribution hang off it).
  const { brand_id: _brand, ...rest } = value;
  void _brand;
  const { data, error } = await supabase.from("campaigns").update(rest).eq("id", campaignId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "You don't have permission to edit this campaign." };
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  return { ok: true, message: "Saved." };
}

export async function createDeal(campaignId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireSession();
  const { value, fieldErrors } = validateDeal(formToRecord(form));
  if (!value) return { fieldErrors };
  const supabase = await createClient();
  const { data: campaign } = await supabase.from("campaigns").select("brand_id").eq("id", campaignId).maybeSingle();
  if (!campaign) return { error: "Campaign not found." };
  const { error } = await supabase.from("deals").insert({ ...value, campaign_id: campaignId, brand_id: campaign.brand_id });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: true, message: "Deal added." };
}

export async function updateDeal(campaignId: string, dealId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireSession();
  const { value, fieldErrors } = validateDeal(formToRecord(form));
  if (!value) return { fieldErrors };
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("deals")
    .select("discount_code, create_shopify_discount, shopify_discount_status")
    .eq("id", dealId)
    .maybeSingle();
  if (!current) return { error: "Deal not found." };

  const update: Record<string, unknown> = { ...value };
  // Changing the code (or turning auto-create on) means Shopify needs a fresh discount.
  if (value.create_shopify_discount && (value.discount_code !== current.discount_code || !current.create_shopify_discount)) {
    update.shopify_discount_status = "pending";
    update.shopify_discount_error = null;
  }
  if (!value.create_shopify_discount && current.shopify_discount_status === "pending") {
    update.shopify_discount_status = "not_requested";
  }
  const { data, error } = await supabase.from("deals").update(update).eq("id", dealId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "You don't have permission to edit this deal." };
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/deals/${dealId}`);
  return { ok: true, message: "Saved." };
}

export async function deleteDeal(campaignId: string, dealId: string): Promise<void> {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from("deals").delete().eq("id", dealId);
  if (error) throw new Error(friendlyDbError(error));
  revalidatePath(`/campaigns/${campaignId}`);
  redirect(`/campaigns/${campaignId}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { friendlyDbError, optStr, str, type FormState } from "@/lib/forms";

function normalizeUrl(v: string | null): string | null | false {
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    return new URL(withScheme).toString().replace(/\/$/, "");
  } catch {
    return false;
  }
}

function normalizeShopDomain(v: string | null): string | null | false {
  if (!v) return null;
  const host = v.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host) ? host : false;
}

export async function createBrand(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireAdmin();
  const name = str(form, "name");
  const website = normalizeUrl(optStr(form, "website_url"));
  if (!name) return { fieldErrors: { name: "Brand name is required." } };
  if (website === false) return { fieldErrors: { website_url: "That doesn't look like a web address." } };
  const slug = slugify(name);
  if (!slug) return { fieldErrors: { name: "Use at least one letter or number." } };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .insert({ org_id: session.org.id, name, slug, website_url: website })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/settings/brands");
  redirect(`/settings/brands/${data.id}`);
}

export async function updateBrand(brandId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const name = str(form, "name");
  const website = normalizeUrl(optStr(form, "website_url"));
  const shop = normalizeShopDomain(optStr(form, "shopify_store_domain"));
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Brand name is required.";
  if (website === false) fieldErrors.website_url = "That doesn't look like a web address.";
  if (shop === false) fieldErrors.shopify_store_domain = "Use the store's .myshopify.com address, e.g. hotshots.myshopify.com";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("brands")
    .update({ name, website_url: website, shopify_store_domain: shop })
    .eq("id", brandId);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/settings/brands/${brandId}`);
  revalidatePath("/settings/brands");
  return { ok: true, message: "Saved." };
}

export async function setBrandMember(brandId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const userId = str(form, "user_id");
  const role = str(form, "role");
  if (!userId) return { error: "Pick a teammate." };
  if (role !== "editor" && role !== "viewer") return { error: "Pick a role." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_members")
    .upsert({ brand_id: brandId, user_id: userId, role }, { onConflict: "brand_id,user_id" });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/settings/brands/${brandId}`);
  return { ok: true, message: "Access updated." };
}

export async function removeBrandMember(brandId: string, userId: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("brand_members").delete().eq("brand_id", brandId).eq("user_id", userId);
  if (error) throw new Error(friendlyDbError(error));
  revalidatePath(`/settings/brands/${brandId}`);
}

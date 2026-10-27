"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { friendlyDbError, optStr, str, type FormState } from "@/lib/forms";
import { normalizeHandle } from "@/lib/creators/handles";
import { parseCreatorCsv, planCreatorImport, type ExistingAccount, type ImportPlan } from "@/lib/creators/csv-import";
import { PLATFORMS, type Platform } from "@/lib/types";

function parseTags(raw: string): string[] {
  return Array.from(new Set(raw.split(/[,;]/).map((t) => t.trim().toLowerCase()).filter(Boolean)));
}

function creatorFields(form: FormData) {
  const email = optStr(form, "email")?.toLowerCase() ?? null;
  return {
    name: str(form, "name"),
    email,
    phone: optStr(form, "phone"),
    notes: optStr(form, "notes"),
    tags: parseTags(str(form, "tags")),
  };
}

function validateCreator(f: ReturnType<typeof creatorFields>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!f.name) errors.name = "Name is required.";
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errors.email = "That email doesn't look right.";
  return errors;
}

export async function createCreator(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  const fields = creatorFields(form);
  const fieldErrors = validateCreator(fields);

  const accounts: Array<{ platform: Platform; handle: string; profile_url: string }> = [];
  for (const p of PLATFORMS) {
    const raw = str(form, p);
    if (!raw) continue;
    const r = normalizeHandle(p, raw);
    if (r.ok) accounts.push({ platform: p, handle: r.handle, profile_url: r.profileUrl });
    else fieldErrors[p] = r.error;
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  // Dedupe: if any handle is already on a creator, send the user there instead of creating a duplicate.
  for (const a of accounts) {
    const { data: hit } = await supabase
      .from("creator_accounts")
      .select("creator_id, creators(name)")
      .eq("platform", a.platform)
      .eq("handle", a.handle)
      .maybeSingle();
    if (hit) {
      const name = (hit.creators as unknown as { name: string } | null)?.name ?? "another creator";
      return { fieldErrors: { [a.platform]: `@${a.handle} is already on ${name}. Open that creator instead.` } };
    }
  }

  const { data, error } = await supabase.rpc("import_creators", {
    p_org_id: session.org.id,
    p_plan: { creates: [{ ...fields, accounts }], merges: [] },
  });
  if (error) return { error: friendlyDbError(error) };
  const createdId = (data as { created_ids?: string[] } | null)?.created_ids?.[0];
  revalidatePath("/creators");
  redirect(createdId ? `/creators/${createdId}` : "/creators");
}

export async function updateCreator(creatorId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireSession();
  const fields = creatorFields(form);
  const fieldErrors = validateCreator(fields);
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  const supabase = await createClient();
  const { data, error } = await supabase.from("creators").update(fields).eq("id", creatorId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "You don't have permission to edit creators." };
  revalidatePath(`/creators/${creatorId}`);
  return { ok: true, message: "Saved." };
}

export async function addCreatorAccount(creatorId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  const platform = str(form, "platform") as Platform;
  if (!PLATFORMS.includes(platform)) return { fieldErrors: { platform: "Pick a platform." } };
  const r = normalizeHandle(platform, str(form, "handle"));
  if (!r.ok) return { fieldErrors: { handle: r.error } };

  const supabase = await createClient();
  const { data: hit } = await supabase
    .from("creator_accounts")
    .select("creator_id, creators(name)")
    .eq("platform", platform)
    .eq("handle", r.handle)
    .maybeSingle();
  if (hit) {
    const name = (hit.creators as unknown as { name: string } | null)?.name;
    return {
      fieldErrors: {
        handle: hit.creator_id === creatorId ? "This creator already has that account." : `@${r.handle} is already on ${name}.`,
      },
    };
  }
  const { error } = await supabase.from("creator_accounts").insert({
    creator_id: creatorId,
    org_id: session.org.id,
    platform,
    handle: r.handle,
    profile_url: r.profileUrl,
  });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/creators/${creatorId}`);
  return { ok: true, message: `Added @${r.handle}.` };
}

export async function removeCreatorAccount(creatorId: string, accountId: string): Promise<void> {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from("creator_accounts").delete().eq("id", accountId).eq("creator_id", creatorId);
  if (error) throw new Error(friendlyDbError(error));
  revalidatePath(`/creators/${creatorId}`);
}

// ---------------------------------------------------------------------------
// CSV import: preview first, then commit the exact plan the user saw.
// ---------------------------------------------------------------------------

export interface ImportPreview {
  error?: string;
  fileName?: string;
  csv?: string;
  unknownColumns?: string[];
  plan?: ImportPlan;
  result?: { created: number; merged: number; accounts_added: number; skipped_accounts: Array<{ platform: string; handle: string }> };
}

const MAX_BYTES = 2 * 1024 * 1024;

async function buildPlan(csv: string): Promise<{ plan: ImportPlan; unknownColumns: string[] } | { error: string }> {
  const parsed = parseCreatorCsv(csv);
  if (parsed.missingName) return { error: "The file needs a \"name\" column. Download the template to see the expected columns." };
  if (parsed.rows.length === 0) return { error: "The file has no rows." };
  if (parsed.rows.length > 5000) return { error: "That's more than 5,000 rows. Split the file and import it in parts." };

  const supabase = await createClient();
  const existing: ExistingAccount[] = [];
  // Page through all accounts (PostgREST caps responses at 1000 rows by default).
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("creator_accounts")
      .select("creator_id, platform, handle, creators(name)")
      .range(from, from + 999);
    if (error) return { error: `Couldn't load existing creators: ${error.message}` };
    for (const a of data ?? []) {
      existing.push({
        creator_id: a.creator_id,
        platform: a.platform,
        handle: a.handle,
        creator_name: (a.creators as unknown as { name: string } | null)?.name ?? "Unknown",
      });
    }
    if (!data || data.length < 1000) break;
  }
  return { plan: planCreatorImport(parsed.rows, existing), unknownColumns: parsed.unknownColumns };
}

export async function previewImport(_prev: ImportPreview, form: FormData): Promise<ImportPreview> {
  await requireSession();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file first." };
  if (file.size > MAX_BYTES) return { error: "That file is larger than 2 MB." };
  const csv = await file.text();
  const built = await buildPlan(csv);
  if ("error" in built) return { error: built.error };
  return { fileName: file.name, csv, ...built };
}

export async function commitImport(_prev: ImportPreview, form: FormData): Promise<ImportPreview> {
  const session = await requireSession();
  const csv = str(form, "csv");
  if (!csv) return { error: "Nothing to import. Choose the file again." };
  // Re-plan against the current database so a teammate's edits since the preview can't cause duplicates.
  const built = await buildPlan(csv);
  if ("error" in built) return { error: built.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_creators", { p_org_id: session.org.id, p_plan: built.plan });
  if (error) return { error: friendlyDbError(error), csv, plan: built.plan, unknownColumns: built.unknownColumns };
  revalidatePath("/creators");
  return { plan: built.plan, result: data as ImportPreview["result"] };
}

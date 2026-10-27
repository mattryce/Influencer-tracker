"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/session";
import { friendlyDbError, str, type FormState } from "@/lib/forms";

export async function inviteTeammate(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireAdmin();
  const email = str(form, "email").toLowerCase();
  const orgRole = str(form, "org_role") === "admin" ? "admin" : "member";
  const brandRole = str(form, "brand_role") === "viewer" ? "viewer" : "editor";
  const brandIds = form.getAll("brand_ids").filter((v): v is string => typeof v === "string" && v.length > 0);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { fieldErrors: { email: "Enter a valid email address." } };
  if (orgRole === "member" && brandIds.length === 0) {
    return { fieldErrors: { brand_ids: "Pick at least one brand, or make them an admin." } };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("org_invites").upsert(
    {
      org_id: session.org.id,
      email,
      org_role: orgRole,
      brand_ids: brandIds,
      brand_role: brandRole,
      invited_by: session.userId,
      accepted_at: null,
    },
    { onConflict: "org_id,email" },
  );
  if (error) return { error: friendlyDbError(error) };

  // Send the invite email. If they already have an account, the DB trigger has already
  // granted access and they just need to sign in.
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { error: mailError } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/`,
  });
  revalidatePath("/settings/team");
  if (mailError) {
    if (/already been registered|already registered|exists/i.test(mailError.message)) {
      return { ok: true, message: `${email} already has an account — their access is updated. They can sign in now.` };
    }
    return {
      error: `Access is saved, but the invite email failed to send (${mailError.message}). They can still sign in at the login page with ${email}.`,
    };
  }
  return { ok: true, message: `Invite sent to ${email}.` };
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("org_invites").delete().eq("id", inviteId).is("accepted_at", null);
  if (error) throw new Error(friendlyDbError(error));
  revalidatePath("/settings/team");
}

export async function setOrgRole(userId: string, role: "admin" | "member"): Promise<void> {
  const session = await requireAdmin();
  if (userId === session.userId) throw new Error("You can't change your own role.");
  const supabase = await createClient();
  const { error } = await supabase.from("org_members").update({ role }).eq("org_id", session.org.id).eq("user_id", userId);
  if (error) throw new Error(friendlyDbError(error));
  revalidatePath("/settings/team");
}

export async function removeTeammate(userId: string): Promise<void> {
  const session = await requireAdmin();
  if (userId === session.userId) throw new Error("You can't remove yourself.");
  const supabase = await createClient();
  // Brand access is per-brand; clear it for this org's brands, then the org membership.
  const { data: brands } = await supabase.from("brands").select("id").eq("org_id", session.org.id);
  const ids = (brands ?? []).map((b) => b.id);
  if (ids.length) {
    const { error } = await supabase.from("brand_members").delete().eq("user_id", userId).in("brand_id", ids);
    if (error) throw new Error(friendlyDbError(error));
  }
  const { error } = await supabase.from("org_members").delete().eq("org_id", session.org.id).eq("user_id", userId);
  if (error) throw new Error(friendlyDbError(error));
  revalidatePath("/settings/team");
}

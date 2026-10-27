"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { str, type FormState } from "@/lib/forms";

export async function sendMagicLink(_prev: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  const next = str(form, "next") || "/";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };

  // Only invited people get an account created. Existing users can always sign in.
  const admin = createAdminClient();
  const { data: invite } = await admin.from("org_invites").select("id").eq("email", email).maybeSingle();

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: Boolean(invite),
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next.startsWith("/") ? next : "/")}`,
    },
  });

  if (error) {
    // Supabase returns a generic error when shouldCreateUser is false and the user doesn't exist.
    if (!invite && /signups? not allowed|not found|otp_disabled/i.test(error.message)) {
      return { error: "This email hasn't been invited yet. Ask an admin to invite you from Settings → Team." };
    }
    if (error.status === 429) return { error: "Too many sign-in emails were sent. Wait a minute and try again." };
    return { error: `Couldn't send the sign-in link: ${error.message}` };
  }
  return { ok: true, message: `Check ${email} for a sign-in link. It expires in 1 hour.` };
}

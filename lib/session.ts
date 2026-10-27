import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/types";

export interface SessionContext {
  userId: string;
  email: string;
  org: { id: string; name: string; role: OrgRole };
}

/** Signed-in user + their organization. Redirects if not signed in or not invited anywhere. */
export const requireSession = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");

  const { data: orgs, error } = await supabase.rpc("my_orgs");
  if (error) throw new Error(`Couldn't load your organization: ${error.message}`);
  const org = (orgs as Array<{ org_id: string; org_name: string; role: OrgRole }> | null)?.[0];
  if (!org) redirect("/no-access");

  return {
    userId: claims.sub,
    email: String(claims.email ?? ""),
    org: { id: org.org_id, name: org.org_name, role: org.role },
  };
});

export async function requireAdmin(): Promise<SessionContext> {
  const session = await requireSession();
  if (session.org.role !== "admin") redirect("/");
  return session;
}

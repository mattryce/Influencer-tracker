import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/lib/session";

/** Brand ids the user can edit (admins: all brands they can see). Mirrors private.can_edit_brand for UI decisions. */
export async function editableBrandIds(session: SessionContext): Promise<Set<string>> {
  const supabase = await createClient();
  if (session.org.role === "admin") {
    const { data } = await supabase.from("brands").select("id").eq("org_id", session.org.id);
    return new Set((data ?? []).map((b) => b.id));
  }
  const { data } = await supabase.from("brand_members").select("brand_id").eq("user_id", session.userId).eq("role", "editor");
  return new Set((data ?? []).map((b) => b.brand_id));
}

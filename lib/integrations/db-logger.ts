import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ApiLogger } from "./logged-fetch";

/** Writes api_logs rows with the service role (users can't insert logs directly). */
export const dbApiLogger: ApiLogger = async (entry) => {
  const { error } = await createAdminClient().from("api_logs").insert(entry);
  if (error) throw new Error(error.message);
};

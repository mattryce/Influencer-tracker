export interface FormState {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const initialFormState: FormState = {};

export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

/** Parse a money field. Returns null for blank, NaN for invalid. */
export function money(form: FormData, key: string): number | null {
  const raw = str(form, key).replace(/[$,\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

/** Turn a Postgres/PostgREST error into something a non-technical teammate can act on. */
export function friendlyDbError(err: { message: string; code?: string; details?: string | null }): string {
  if (err.code === "23505") {
    if (/discount_code/.test(err.message + (err.details ?? ""))) return "That discount code is already used by another deal for this brand.";
    if (/utm_tag/.test(err.message + (err.details ?? ""))) return "That UTM tag is already used by another deal for this brand.";
    if (/campaign_id, creator_id|deals_campaign_id_creator_id/.test(err.message + (err.details ?? "")))
      return "This creator already has a deal in this campaign.";
    if (/handle/.test(err.message + (err.details ?? ""))) return "That handle is already on another creator.";
    if (/slug/.test(err.message + (err.details ?? ""))) return "A brand with that short name already exists.";
    return "That already exists.";
  }
  if (err.code === "42501" || /row-level security/.test(err.message)) return "You don't have permission to do that.";
  if (err.code === "23514") return "One of the values isn't allowed. Check the highlighted fields.";
  if (err.code === "P0001") return err.message;
  return `Something went wrong saving this: ${err.message}`;
}

export interface ApiLogEntry {
  org_id: string | null;
  brand_id: string | null;
  platform: string;
  endpoint: string;
  method: string;
  status_code: number | null;
  duration_ms: number;
  error: string | null;
}

export type ApiLogger = (entry: ApiLogEntry) => Promise<void>;

/** Strip query strings so access tokens and signatures never end up in api_logs. */
export function redactEndpoint(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split("?")[0];
  }
}

/**
 * fetch() wrapper that records platform, endpoint, status and duration for every external call.
 * Logging failures are swallowed (and printed) so they never break the integration itself.
 */
export async function loggedFetch(
  log: ApiLogger,
  meta: { platform: string; orgId?: string | null; brandId?: string | null },
  url: string,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const started = Date.now();
  const entry: ApiLogEntry = {
    org_id: meta.orgId ?? null,
    brand_id: meta.brandId ?? null,
    platform: meta.platform,
    endpoint: redactEndpoint(url),
    method: (init?.method ?? "GET").toUpperCase(),
    status_code: null,
    duration_ms: 0,
    error: null,
  };
  try {
    const res = await fetchImpl(url, init);
    entry.status_code = res.status;
    if (!res.ok) entry.error = `HTTP ${res.status} ${res.statusText}`.trim();
    return res;
  } catch (err) {
    entry.error = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    entry.duration_ms = Date.now() - started;
    await log(entry).catch((e) => console.error("api_logs write failed", e));
  }
}

import type { NextRequest } from "next/server";

/**
 * The origin the browser actually used. `request.nextUrl.origin` can report the server's bind
 * address (e.g. localhost) instead, which would drop the auth cookies set on the real host.
 */
export function requestOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return request.nextUrl.origin;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

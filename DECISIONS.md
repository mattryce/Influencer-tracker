# DECISIONS.md

Decisions made while building, and anything where we deviated from SPEC.md. Newest last.

## D-001 — Next.js 16 + Cache Components (2026-10-27)
`create-next-app` now ships Next.js 16 with Cache Components and Partial Prefetching on. We kept them (they become the default in the next major). Consequences:
- Auth session refresh lives in `proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`), following the current Supabase SSR guide (`getClaims()` in the proxy).
- `lib/supabase/server.ts` calls `await connection()` before creating the client. supabase-js reads the clock while loading a session, which Cache Components forbids during prerendering; every query is per-user anyway.
- Client components that read the URL (`usePathname`) sit inside `<Suspense>`.

## D-002 — Organization above brands; creators shared across brands (2026-10-27)
SPEC §6 scopes access by brand. We added an `organizations` table (Marcosm LLC) above `brands`:
- **Brands, campaigns, deals** (and later posts, orders) are brand-scoped. Org **admins** see every brand; **members** see only brands they're added to, as **editor** or **viewer**.
- **Creators** belong to the organization, not a brand, so one creator working with three brands is one record and cross-brand ROI (P1) works. Any org member can see the roster; editors on at least one brand can change it. A creator's *deals* are still only visible for brands you can see.
- This also makes P2 multi-tenant mode a matter of adding more organizations — no re-scoping later.

## D-003 — Invite-only magic-link sign-in (2026-10-27)
No passwords. Admins invite by email (Settings → Team); invites live in `org_invites` and are converted into memberships by a DB trigger on first sign-in (or immediately if the person already has an account). The login page only creates an account for invited emails. Matt's admin invite is created by the bootstrap migration.

## D-004 — Handles are normalized and unique per platform (2026-10-27)
`creator_accounts.handle` is stored lowercase without `@` (enforced by a CHECK) and is unique per (org, platform). The app accepts @handles or profile links and normalizes them (`lib/creators/handles.ts`). YouTube links without an `@handle` (e.g. `/channel/UC…`) are rejected with instructions, because channel IDs are case-sensitive and can't be deduped against handles.

## D-005 — CSV import is preview-then-commit, applied in one transaction (2026-10-27)
The import plan is computed in TypeScript (`lib/creators/csv-import.ts`, unit-tested on a 50-row fixture), shown to the user, then re-planned against the current DB and applied by the `import_creators` RPC in a single transaction with RLS still enforced. Rows matching an existing handle merge into that creator (fill blank email/phone, union tags, add new accounts); rows in the same file sharing a handle are combined; a row whose handles point at two different existing creators is rejected.

## D-006 — Deliverables stored structured, typed as text (2026-10-27)
Deals store deliverables as JSON (`[{platform, type, count}]`) so "done vs. owed" can be computed when posts arrive. The team types them the way they do today ("2 Reels + 3 Stories"); `lib/deals/deliverables.ts` parses that and rejects anything it doesn't understand with an example.

## D-007 — Discount codes and UTM tags are unique per brand (2026-10-27)
Partial unique indexes on `deals (brand_id, discount_code)` and `(brand_id, utm_tag)`. If two deals shared a code, attribution would be ambiguous. Turning on "create in Shopify" requires a code and marks the deal `pending`; the UI says plainly that the code won't work at checkout until the brand's Shopify store is connected (Phase 4).

## D-008 — shadcn/ui components written in-repo (2026-10-27)
The shadcn registry (ui.shadcn.com) was unreachable from the build environment, so the handful of components we need (`components/ui/*`) were written by hand in shadcn's style, with a `components.json` so `npx shadcn add` works later from a normal machine.

## D-009 — Tokens never stored in app tables (2026-10-27)
`brands` and `creator_accounts` only hold `*_secret_id` references. Phase 2/4 will store OAuth/Admin API tokens in Supabase Vault and read them with the service role.

## D-010 — "Product value sent" shown separately from fees (2026-10-27)
Open question in SPEC §9. Until Matt decides, campaign pages show fees and product value as separate numbers; ROI math (Phase 5) will take a setting rather than hard-coding either answer.

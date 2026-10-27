# PROGRESS.md

## Phase 1 — Foundation ✅ code complete (2026-10-27) · ⏳ waiting on a hosted Supabase project

### Done
- **Repo + app:** Next.js 16 (App Router, TypeScript, Tailwind v4, shadcn-style UI), Supabase SSR auth via `proxy.ts`.
- **Database** (`supabase/migrations/`): organizations, profiles, org/brand membership, invites, brands, creators, creator accounts, follower-count history, campaigns, deals, integration_health, api_logs, alerts. RLS on every table. Matt is bootstrapped as admin on first sign-in.
- **Auth + team:** invite-only magic-link sign-in; Settings → Team (invite, revoke, make admin/member, remove); per-brand access (can edit / view only) on each brand page.
- **Brands:** create/edit brands, Shopify store address, and a connection card for Instagram and Shopify showing live status from `integration_health` ("Not connected — no sync has ever run" until Phases 2/4).
- **Creator roster:** add/edit creators, add/remove social accounts (paste a handle or profile link), search by name/email/@handle, tag filter, follower counts shown as "Not available — not synced yet" (never 0).
- **CSV import:** preview → confirm, dedupe on handle against the DB and within the file, row-level errors/warnings, template download, single-transaction commit.
- **Campaigns + deals:** create/edit campaigns (dates, budget, goal, required hashtags/mentions); add/edit/delete deals (fee, product value, deliverables like "2 Reels + 3 Stories", due date, discount code, UTM tag, usage rights, "create code in Shopify" toggle → `pending` until Shopify is connected).
- **Overview:** per-brand active campaigns/deals/fees + connection status, open alerts, upcoming/overdue deliverables.
- **Integration scaffolding:** common adapter interface (`lib/integrations/types.ts`) whose metric type can't express a silent 0; `loggedFetch` writes every external call to `api_logs` with query strings (tokens) stripped.
- **Seed data:** 7 real brand names, fake creators/campaigns/deals (all labelled FAKE), fake teammates `cece@example.com` (editor, 2 brands) and `content@example.com` (viewer, 1 brand).

### Verified
- `npm test` — 41 unit tests (handle normalization, CSV parse/plan on the 50-row fixture, deliverables parsing, campaign/deal validation, API logging).
- `npm run test:db` — 22 tests on a throwaway Postgres: RLS isolation between admins/members/viewers/outsiders, invite acceptance, dedupe constraints, deal/brand consistency triggers, and the 50-row import end-to-end through the RPC.
- `tests/e2e/smoke.mjs` — full browser run against a **local Supabase stack** (real GoTrue magic links via Mailpit, PostgREST, Postgres 17) + production build: sign-in, uninvited refusal, brand create/edit, invite, 50-row CSV import (45 created / 1 merged / 1 skipped, re-import creates 0), duplicate-handle block, campaign + deal create/edit, duplicate discount code + bad deliverables errors, member and viewer access limits. **All pass.**
- `supabase db lint` clean; `next build`, `tsc`, `eslint` clean.

### Not yet verified against a real (hosted) account
- Nothing has run against a hosted Supabase project yet — none exists for this app (see Blocked).
- Invite emails use Supabase's built-in mailer, which is rate-limited and meant for testing. Production needs custom SMTP (Gmail) configured in Supabase Auth.

### Blocked / needs Matt
1. **Supabase project:** OK to create a new project "influencer-tracker" in the Marcosm LLC org (adds a project's compute cost to the bill), or should this live in an existing project?
2. **Hosting** (SPEC §9) — not needed until we deploy.
3. Before Phase 2: Meta developer app details (checklist will be in Phase 2).

## Phase 2 — Instagram capture — not started

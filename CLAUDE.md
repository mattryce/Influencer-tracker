# CLAUDE.md — Marcosm Influencer Tracker

You are building an internal influencer-tracking app for Marcosm LLC, a multi-brand marketing agency. Read `SPEC.md` before writing any code. It is the source of truth for scope, data model, and build order.

## Why this exists
Marcosm currently pays for Sprout Social Influencer Marketing (formerly Tagger). It doesn't reliably capture creator posts, metrics are often missing or stale, and the team stops trusting it. Every influencer tool Matt has tried has had the same problem. The lesson the team has learned: **a tool that doesn't work right on day one gets abandoned.** Reliability and honesty about data beat feature count.

## Non-negotiable principles
1. **Never show a fake or silently stale number.** Every metric stores its source (`creator_oauth`, `brand_graph_api`, `public_api`, `screenshot_ocr`, `manual`) and `fetched_at`. The UI shows both. Missing data displays as "Not available — [reason]", never as 0.
2. **Every integration has a visible health status.** Connected / token expiring / broken / rate-limited, with the last successful sync time. A broken connection triggers an email alert, not a silent failure.
3. **Capture ephemeral content immediately.** Instagram Story mentions disappear after 24 hours. When a webhook fires, download the media to Supabase Storage right away.
4. **Revenue beats vanity metrics.** Shopify discount-code and UTM attribution is a P0 feature, not an add-on.
5. **Verify every external API against current official docs before implementing.** Meta, TikTok, and YouTube change endpoints, scopes, and limits often. Do not rely on memory. If the docs contradict SPEC.md, follow the docs and note the change in `DECISIONS.md`.

## Stack (use what Marcosm already pays for — no new subscriptions without asking)
- **Database / auth / storage / scheduled jobs:** Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron)
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- **Repo:** GitHub (account `mattryce`)
- **Email alerts:** Gmail via SMTP or the Gmail API (the team uses email, text, and ClickUp — not Slack)
- **Screenshot reading:** Anthropic API (vision) for creator-submitted insight screenshots
- **Commerce:** Shopify Admin API (each brand's store)
- **Hosting:** see Open Questions in SPEC.md — ask before creating any new hosting account

## How to work
- Work through the phases in SPEC.md in order. Finish a phase completely — migrations, code, tests, seed data — before starting the next.
- Work autonomously. Only stop and ask Matt when you need: a credential or API key, a Meta/TikTok developer app or App Review step, a hosting decision, or a choice that changes scope.
- Write all schema changes as Supabase migrations in `supabase/migrations/`. Enable Row Level Security on every table.
- Put every third-party integration behind an adapter in `lib/integrations/<platform>/` with a common interface (`fetchCreatorProfile`, `fetchPostMetrics`, `listNewMentions`, `health`). This keeps one broken platform from breaking the app.
- Write tests for: attribution math, EMV calculation, metric deduplication, and every webhook handler (use recorded fixture payloads).
- Never commit secrets. Use `.env.local` and Supabase secrets; keep `.env.example` current.
- Log every external API call (platform, endpoint, status, duration) to an `api_logs` table so problems are debuggable.
- At the end of each phase, update `PROGRESS.md` with what's done, what's verified working against a real account, and what's blocked.

## Definition of done for any feature
It works against a real connected account (not just mocks), it handles the error case visibly, and a non-technical team member could use it without explanation.

## Codebase notes (for agents)
- Next.js 16 with Cache Components on. Read `node_modules/next/dist/docs/` before using framework APIs (see `AGENTS.md`). Auth refresh lives in `proxy.ts` (the old `middleware.ts`).
- Every server-side Supabase query goes through `lib/supabase/server.ts` (RLS as the user). `lib/supabase/admin.ts` (service role) is only for invites, logging, health, webhooks and cron.
- Forms use `ActionForm` + `useActionState` from `components/app/form-bits.tsx` so validation errors never wipe typed input.
- Tests: `npm test` (unit), `npm run test:db` (migrations + RLS on a throwaway Postgres), `tests/e2e/smoke.mjs` (full browser run against `npx supabase start` + `next start`).

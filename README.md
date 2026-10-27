# Marcosm Influencer Tracker

Internal tool for tracking creator deals, posts, performance and Shopify revenue across Marcosm brands.
Scope and build order: [`SPEC.md`](SPEC.md). Status: [`PROGRESS.md`](PROGRESS.md). Decisions: [`DECISIONS.md`](DECISIONS.md).

## Local development

Requirements: Node 22+, Docker (for the local Supabase stack).

```bash
npm install
npx supabase start          # Postgres, Auth, REST, Mailpit on 127.0.0.1:543xx; applies migrations + seed
cp .env.example .env.local  # then paste the URL / publishable key / secret key printed by `supabase start`
npm run dev                 # http://127.0.0.1:3000
```

Sign in at http://127.0.0.1:3000/login with an invited email (`mattryce@marcosm.co`, or the seeded `cece@example.com` / `content@example.com`). The magic link lands in Mailpit at http://127.0.0.1:54324.

Use `127.0.0.1`, not `localhost`, so auth cookies and redirect URLs match `supabase/config.toml`.

## Tests

```bash
npm test             # unit tests
npm run test:db      # migrations + RLS against a throwaway local Postgres (needs initdb/pg_ctl)
npm run build && npm start   # then, with `supabase start` running:
node tests/e2e/smoke.mjs http://127.0.0.1:3000 [screenshot-dir]   # browser smoke test (needs Playwright)
```

## Layout

- `app/(app)/` — signed-in pages (overview, creators, campaigns, settings)
- `app/login`, `app/auth/*` — magic-link sign-in
- `lib/` — domain logic (handle normalization, CSV import planning, deliverables, validation), Supabase clients, integration adapters
- `supabase/migrations/` — schema + RLS; `supabase/seed.sql` — fake local data
- `tests/` — DB tests, fixtures, e2e smoke test

## Deploying

1. Create the Supabase project, then `npx supabase link --project-ref <ref>` and `npx supabase db push`. (Don't load `seed.sql` in production.)
2. In Supabase → Auth → URL Configuration, set the Site URL and add `https://<app-domain>/auth/callback` to Redirect URLs. Configure custom SMTP so invite/sign-in emails aren't rate-limited.
3. Set the env vars from `.env.example` on the host.

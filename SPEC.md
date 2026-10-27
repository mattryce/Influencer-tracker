# SPEC.md — Marcosm Influencer Tracker

## 1. Problem
Marcosm runs influencer/creator programs across several brands (Hot Shot's Secret, Stainless Diesel, D&J Precision Machine, Canadian Diesel Online, CNC Fabrication, MPMC, Firepunk Diesel, and others). The current tool (Sprout Social Influencer Marketing / Tagger) misses posts, shows incomplete or stale metrics, and can't tie creator activity to sales. The team can't answer the basic questions: *What did each creator post? How did it perform? Did it sell anything? Was it worth what we paid?*

## 2. Goals
1. Capture at least 95% of creator posts that tag or mention a brand, within 1 hour of posting (Instagram) and within 24 hours (other platforms).
2. Every creator in a campaign has a single page showing posts, performance, cost, and attributed Shopify revenue.
3. Every number in the app shows where it came from and when.
4. The team uses it daily without Matt chasing fixes — zero silent integration failures.

## 3. Non-goals (v1)
- **Influencer discovery / search database.** That requires scraped third-party data, which is the unreliable part of existing tools. v1 tracks creators Marcosm already works with.
- **Audience demographics and fake-follower scoring.** Only available reliably via creator OAuth; deferred to P2.
- **Creator payments / contracts.** Track cost per deal, but don't move money.
- **Public creator marketplace.** Internal tool first. (Could become a sellable product later — see P2.)

## 4. Users
- **Matt (owner):** cross-brand ROI view, which creators to renew.
- **Marketing Ops (Cece):** manages creators, campaigns, deliverables, reporting.
- **Content team:** sees and downloads creator content for reuse.
- **Creators (external, limited portal):** connect their accounts, submit posts and insight screenshots.

## 5. How data actually gets in (critical — verify each against current docs)
No single method covers everything, so the app combines several and labels each metric by source.

| Source | What it gives | Reliability |
|---|---|---|
| **Brand's own Instagram Business account** (Instagram Graph API via Facebook Login) | Posts the brand is tagged in (`/tags` edge), caption @mentions (mentions webhook), Story mentions (messaging webhook — **24h only, download immediately**), likes/comments on those posts | High for capture; limited metrics |
| **Business Discovery** (Instagram Graph API) | Public follower count and recent post like/comment counts for creators with Business/Creator accounts | Medium; no reach/views |
| **Creator OAuth** (creator connects their own IG / TikTok / YouTube account through the portal) | First-party insights: views, reach, saves, shares, watch time | Highest — this is the "actually works" path; push creators to connect |
| **YouTube Data API** (API key) | Public views/likes/comments on any video | High |
| **TikTok** (Login Kit + Display API, creator-authorized) | Creator's video list with view/like/comment/share counts | High when connected; TikTok has no general brand-mention feed for this use — verify current options |
| **Screenshot OCR** (creator uploads insight screenshots; Anthropic vision extracts numbers) | Reach/views/etc. when creator won't connect | Medium; flagged as `screenshot_ocr`, human-confirmable |
| **Manual URL add** | Any post link the team pastes; app refreshes what public APIs allow | Fallback |
| **Shopify Admin API** (per brand store) | Orders using creator discount codes; orders with creator UTM `landing_site` / referrer | High — revenue truth |

Refresh schedule: new posts hourly; post metrics at +1h, +24h, +72h, +7d, +30d, then frozen as "final". Store every snapshot (time series), don't overwrite.

## 6. Data model (Supabase / Postgres)
- `brands` — name, Shopify store domain + token ref, IG account ref, default EMV table
- `users` / `brand_members` — team access per brand (RLS by brand)
- `creators` — name, email, phone, notes, tags, rate card
- `creator_accounts` — creator_id, platform, handle, platform_user_id, oauth status, token ref, follower count history
- `campaigns` — brand_id, name, dates, budget, goal, required hashtags/mentions
- `deals` — campaign_id, creator_id, fee, product value sent, deliverables (e.g., "2 Reels + 3 Stories"), discount code, UTM tag, status
- `posts` — creator_account_id, platform, url, media type, caption, posted_at, capture source, stored media path, matched campaign/deal (nullable), deliverable fulfilled (bool)
- `post_metric_snapshots` — post_id, fetched_at, source, views, reach, impressions, likes, comments, shares, saves, watch time (nullable columns; null = not available)
- `attributed_orders` — brand_id, deal_id, shopify_order_id, method (`discount_code` / `utm`), revenue, order date
- `emv_rates` — brand or global, platform, metric, $ value (editable in settings; seed empty and have Matt enter values — Marcosm currently uses Ayzenberg-based benchmarks in Tagger)
- `integration_health` — integration, scope (brand/creator), status, last_success_at, last_error
- `api_logs`, `alerts`

## 7. Requirements

### P0 — must ship
1. **Brand + team setup.** Create brands, invite team, connect brand IG account and Shopify store. *Accept:* settings page shows each connection's live status.
2. **Creator roster.** Add creators and their handles across platforms; CSV import. *Accept:* importing a 50-row CSV creates creators and accounts with dedupe on handle.
3. **Campaigns and deals.** Create campaign, attach creators with fee, deliverables, discount code, and UTM. *Accept:* creating a deal can auto-create the Shopify discount code (toggle).
4. **Automatic post capture (Instagram).** Tags, @mentions, Story mentions captured via webhooks + hourly `/tags` poll as backstop; media saved to Storage. *Accept:* a test post tagging the brand appears within 1 hour; a test Story mention is saved before it expires.
5. **Manual post add.** Paste any IG/TikTok/YouTube URL; app pulls what it can. *Accept:* works for all three platforms; missing metrics show the reason.
6. **Post matching.** Auto-match captured posts to an active deal by creator + campaign dates + required hashtag/mention; unmatched posts go to a review inbox. *Accept:* team can match/unmatch in one click.
7. **Metric snapshots** on the schedule in §5, with source + timestamp displayed.
8. **Shopify attribution.** Orders webhook + nightly backfill; attribute by discount code, then UTM. *Accept:* a test order using a creator code shows on that deal within 5 minutes.
9. **Creator page + campaign report.** Posts, deliverables done vs. owed, total views/engagement, EMV, attributed revenue, cost, ROI (revenue ÷ cost) and cost per view. Export to CSV and PDF.
10. **Integration health dashboard + email alerts** for broken/expiring connections and overdue deliverables.

### P1 — fast follow
- **Creator portal:** magic-link login, connect IG/TikTok/YouTube via OAuth, see their deliverables, submit post links and insight screenshots (vision OCR → human confirm).
- YouTube and TikTok creator-OAuth metric pulls.
- Cross-brand dashboard for Matt (all brands, ranked creators by ROI).
- Content library: all captured creator media, filterable, downloadable for reuse, with usage-rights flag per deal.
- ClickUp task creation for overdue deliverables.
- Weekly email digest per brand.

### P2 — design for, don't build
- Audience demographics from creator OAuth.
- Discovery of new creators who organically tag the brand ("who's already talking about us").
- Multi-tenant mode so the app could be offered to Marcosm clients or sold — keep `brand_id` scoping clean from day one.

## 8. Build phases (do in order)
1. **Foundation:** repo, Supabase project, auth, brands/team/RLS, creator roster + CSV import, campaigns/deals. Seed with fake data.
2. **Instagram capture:** Meta app setup checklist for Matt, brand IG connect, webhooks, `/tags` poller, Story media capture, review inbox, manual URL add.
3. **Metrics:** snapshot scheduler, Business Discovery + YouTube public pulls, EMV settings + calculation.
4. **Shopify attribution:** store connect, discount-code auto-creation, order webhooks, backfill, attribution logic + tests.
5. **Reporting + health:** creator page, campaign report, exports, health dashboard, email alerts. → **v1 ready for team use.**
6. **Creator portal (P1).**

## 9. Open questions
- **Hosting (blocking for deploy, not for build):** Vercel's free tier doesn't permit commercial use. Options: Vercel Pro, Netlify, or a host Marcosm already pays for. — *Matt*
- **Meta developer app:** Does Marcosm already have a Meta Business / developer app? Which IG permissions require App Review for accounts Marcosm manages vs. creator accounts? — *Claude Code to research, Matt to complete*
- **EMV values:** Enter the per-metric values Marcosm wants to use. — *Matt*
- **Pilot brand:** Which brand and campaign to pilot with first. — *Matt*
- **Creator cost data:** Is product value sent counted as cost in ROI? — *Matt*

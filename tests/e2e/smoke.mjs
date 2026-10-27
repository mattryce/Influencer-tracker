// End-to-end smoke test against a local Supabase stack (`npx supabase start`) + `next start`.
// Signs in via real magic links caught by Mailpit and walks the Phase 1 flows.
// Usage: node tests/e2e/smoke.mjs [baseUrl] [screenshotDir]
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import path from "node:path";

// Uses the machine's Playwright install (not a project dependency); set NODE_PATH to its node_modules if needed.
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const SHOTS = process.argv[3] ?? null;
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const FIXTURE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../fixtures/creators-50.csv");
const RUN = Date.now().toString(36).slice(-5);

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

async function magicLink(email, after) {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages = [] } = await res.json();
    const msg = messages.find((m) => new Date(m.Created).getTime() >= after);
    if (msg) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
      const link = (full.HTML || full.Text).match(/href="([^"]+)"/)?.[1] ?? full.Text.match(/https?:\/\/\S+/)?.[0];
      return link.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no email for ${email}`);
}

async function signIn(browser, email) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  pages.push(page);
  await page.goto(`${BASE}/login`);
  const t = Date.now() - 1000;
  await page.fill("#email", email);
  await page.click("button[type=submit]");
  await page.getByText(/Check .* for a sign-in link/).waitFor();
  await page.goto(await magicLink(email, t));
  await page.waitForURL(`${BASE}/`);
  return page;
}

const browser = await chromium.launch();
const pages = [];
browser.on("disconnected", () => {});
try {
  // Not invited -> clear message, no account created.
  {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${BASE}/creators`);
    assert.match(page.url(), /\/login\?next=%2Fcreators/);
    await page.fill("#email", `stranger-${RUN}@example.com`);
    await page.click("button[type=submit]");
    await page.getByText(/hasn't been invited yet/).waitFor();
    console.log("✓ uninvited email is refused");
  }

  // Matt: bootstrap admin
  const matt = await signIn(browser, "mattryce@marcosm.co");
  await matt.getByText("Hot Shot's Secret").first().waitFor();
  await shot(matt, "01-overview");
  console.log("✓ Matt signs in via magic link and becomes admin");

  // Brands: 7 seeded, create one, set Shopify domain
  await matt.goto(`${BASE}/settings/brands`);
  assert.equal(await matt.locator("tbody tr").count(), 7);
  await matt.fill("#name", `E2E Brand ${RUN}`);
  await matt.fill("#website_url", "example.com");
  await matt.click("text=Add brand");
  await matt.waitForURL(/\/settings\/brands\/[0-9a-f-]{36}$/);
  await matt.getByText("No sync has ever run").first().waitFor();
  await matt.fill("#shopify_store_domain", "https://bad-domain.com");
  await matt.click("text=Save brand");
  await matt.getByText(/myshopify\.com address/).first().waitFor();
  await matt.fill("#shopify_store_domain", `e2e-${RUN}.myshopify.com`);
  await matt.click("text=Save brand");
  await matt.getByText("Saved.").waitFor();
  await shot(matt, "02-brand");
  console.log("✓ create brand, validate + save Shopify domain, connection status shown");

  // Team: invite
  await matt.goto(`${BASE}/settings/team`);
  const invitee = `new-${RUN}@example.com`;
  await matt.fill("#email", invitee);
  await matt.getByLabel("Hot Shot's Secret").check();
  await matt.click("text=Send invite");
  await matt.getByText(`Invite sent to ${invitee}.`).waitFor();
  await matt.getByText("Pending invites").waitFor();
  await shot(matt, "03-team");
  console.log("✓ invite teammate");

  // CSV import (acceptance: 50 rows, dedupe on handle)
  await matt.goto(`${BASE}/creators/import`);
  await matt.setInputFiles("input[type=file]", FIXTURE);
  await matt.click("text=Preview import");
  await matt.getByText("45 new creators").waitFor();
  await matt.getByText("1 matched to existing creator").waitFor();
  await matt.getByText("1 row skipped").waitFor();
  await shot(matt, "04-import-preview");
  await matt.click("text=Import 46 creators");
  await matt.getByText(/Imported\. 45 new creators, 1 existing creator updated/).waitFor();
  console.log("✓ 50-row CSV import: 45 created, 1 merged, 1 skipped");

  // Re-import: nothing new
  await matt.goto(`${BASE}/creators/import`);
  await matt.setInputFiles("input[type=file]", FIXTURE);
  await matt.click("text=Preview import");
  await matt.getByText("0 new creators").waitFor();
  console.log("✓ re-importing the same file creates no duplicates");

  await matt.goto(`${BASE}/creators?q=creator01`);
  assert.equal(await matt.locator("tbody tr").count(), 1);
  await matt.goto(`${BASE}/creators`);
  await shot(matt, "05-creators");

  // Manual add with a duplicate handle is redirected
  await matt.goto(`${BASE}/creators/new`);
  await matt.fill("#name", "Dupe Person");
  await matt.fill("#instagram", "https://instagram.com/JakeTorque_fake");
  await matt.click("button:has-text('Add creator')");
  await matt.getByText(/@jaketorque_fake is already on Jake Torque/).waitFor();
  await matt.fill("#instagram", `fresh_${RUN}`);
  await matt.click("button:has-text('Add creator')");
  await matt.waitForURL(/\/creators\/[0-9a-f-]{36}$/);
  await matt.getByText("Not available — not synced yet").waitFor();
  await shot(matt, "06-creator");
  console.log("✓ add creator, duplicate handle blocked, missing followers shown as Not available");

  // Campaign + deal
  await matt.goto(`${BASE}/campaigns/new`);
  await matt.selectOption("#brand_id", { label: "Hot Shot's Secret" });
  await matt.fill("#name", `E2E Campaign ${RUN}`);
  await matt.fill("#starts_on", "2026-11-01");
  await matt.fill("#ends_on", "2026-10-01");
  await matt.click("text=Create campaign");
  await matt.getByText("End date is before the start date.").waitFor();
  await matt.fill("#ends_on", "2026-12-01");
  await matt.fill("#budget", "$2,500");
  await matt.fill("#required_hashtags", "#HotShotSecret #ad");
  await matt.click("text=Create campaign");
  await matt.waitForURL(/\/campaigns\/[0-9a-f-]{36}$/);
  const campaignUrl = matt.url();

  await matt.selectOption("#creator_id", { label: "Creator 01 (@creator01)" });
  await matt.fill("#fee", "500");
  await matt.fill("#product_value", "80");
  await matt.fill("#deliverables", "2 reels + 1 story");
  await matt.fill("#discount_code", `cr01${RUN}`);
  await matt.check("input[name=create_shopify_discount]");
  await matt.getByText(/Shopify store isn't connected yet/).waitFor();
  await matt.click("text=Add deal");
  await matt.getByText("Deal added.").waitFor();
  await matt.getByText("Waiting for Shopify connection").waitFor();
  await matt.getByText("2 Instagram Reels + 1 Instagram Story").waitFor();

  // Same discount code on another deal for this brand is rejected with a readable message
  await matt.selectOption("#creator_id", { label: "Creator 02 (@creator02)" });
  await matt.fill("#discount_code", `cr01${RUN}`);
  await matt.click("text=Add deal");
  await matt.getByText("That discount code is already used by another deal for this brand.").waitFor();
  await matt.fill("#discount_code", "");
  await matt.fill("#deliverables", "1 podcast");
  await matt.click("text=Add deal");
  await matt.getByText(/Didn't recognise "1 podcast"/).waitFor();
  await shot(matt, "07-campaign");
  console.log("✓ create campaign + deal; duplicate code and bad deliverables rejected clearly");

  // Edit the deal
  await matt.goto(campaignUrl);
  await matt.locator("tbody tr", { hasText: "Creator 01" }).getByText("Edit").click();
  await matt.fill("#fee", "650");
  await matt.click("text=Save deal");
  await matt.getByText("Saved.").waitFor();
  console.log("✓ edit deal");

  // Cece: seeded member with access to 2 brands
  const cece = await signIn(browser, "cece@example.com");
  await cece.goto(`${BASE}/settings/brands`);
  assert.equal(await cece.locator("tbody tr").count(), 2);
  await cece.goto(`${BASE}/campaigns?status=all`);
  assert.equal(await cece.getByText("D&J Precision Machine").count(), 0);
  await cece.goto(`${BASE}/settings/team`);
  assert.equal(await cece.getByText("Invite a teammate").count(), 0);
  await shot(cece, "08-cece-brands");
  console.log("✓ member only sees her brands and can't manage the team");

  // Content viewer: read-only
  const viewer = await signIn(browser, "content@example.com");
  await viewer.goto(campaignUrl);
  assert.equal(await viewer.getByText("Add a creator to this campaign").count(), 0);
  assert.equal(await viewer.locator("button:has-text('Save campaign')").count(), 0);
  console.log("✓ viewer sees campaign read-only");

  console.log("\nALL E2E CHECKS PASSED");
} catch (err) {
  if (SHOTS) for (const [i, p] of pages.entries()) await p.screenshot({ path: path.join(SHOTS, `FAILED-${i}.png`), fullPage: true }).catch(() => {});
  throw err;
} finally {
  await browser.close();
}

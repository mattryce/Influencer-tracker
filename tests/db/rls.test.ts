import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

// Runs against the throwaway database created by scripts/test-db.sh (migrations + seed applied).
const ORG = "00000000-0000-4000-8000-000000000001";
const BRAND_HSS = "10000000-0000-4000-8000-000000000001";
const BRAND_SD = "10000000-0000-4000-8000-000000000002";
const BRAND_DJ = "10000000-0000-4000-8000-000000000003";
const CAMPAIGN_HSS = "30000000-0000-4000-8000-000000000001";
const CREATOR_JAKE = "20000000-0000-4000-8000-000000000001";
const CREATOR_ROSA = "20000000-0000-4000-8000-000000000002";

const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
const users: Record<string, string> = {};

async function createAuthUser(email: string): Promise<string> {
  // Other test files may already have created this user in the shared test database.
  const existing = await db.query("select id from profiles where lower(email) = lower($1)", [email]);
  if (existing.rows[0]) return existing.rows[0].id;
  const { rows } = await db.query("insert into auth.users (email) values ($1) returning id", [email]);
  return rows[0].id;
}

/** Run queries as a signed-in user inside a transaction that is always rolled back. */
async function asUser<T>(userId: string | null, fn: (q: Client["query"]) => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId ?? "", role: "authenticated" }),
    ]);
    return await fn(db.query.bind(db) as Client["query"]);
  } finally {
    await db.query("rollback");
  }
}

async function expectDenied(p: Promise<unknown>) {
  await expect(p).rejects.toThrow(/row-level security|permission denied/);
}

beforeAll(async () => {
  await db.connect();
  users.matt = await createAuthUser("mattryce@marcosm.co");
  users.cece = await createAuthUser("cece@example.com");
  users.content = await createAuthUser("content@example.com");
  users.outsider = await createAuthUser("stranger@example.com");
});

afterAll(async () => {
  await db.end();
});

describe("invites and profiles", () => {
  it("creates a profile and applies Matt's bootstrap admin invite on first login", async () => {
    const { rows } = await db.query("select role from org_members where user_id = $1 and org_id = $2", [users.matt, ORG]);
    expect(rows).toEqual([{ role: "admin" }]);
    const inv = await db.query("select accepted_at from org_invites where email = 'mattryce@marcosm.co'");
    expect(inv.rows[0].accepted_at).not.toBeNull();
  });

  it("applies brand-scoped invites", async () => {
    const { rows } = await db.query(
      "select brand_id, role from brand_members where user_id = $1 order by brand_id",
      [users.cece],
    );
    expect(rows).toEqual([
      { brand_id: BRAND_HSS, role: "editor" },
      { brand_id: BRAND_SD, role: "editor" },
    ]);
  });

  it("applies an invite immediately when the person already has an account", async () => {
    await db.query("begin");
    try {
      const id = await createAuthUser("late@example.com");
      await db.query(
        "insert into org_invites (org_id, email, brand_ids, brand_role) values ($1, 'late@example.com', $2, 'viewer')",
        [ORG, [BRAND_DJ]],
      );
      const { rows } = await db.query("select brand_id, role from brand_members where user_id = $1", [id]);
      expect(rows).toEqual([{ brand_id: BRAND_DJ, role: "viewer" }]);
    } finally {
      await db.query("rollback");
    }
  });
});

describe("brand visibility", () => {
  it("org admin sees every brand", async () => {
    const n = await asUser(users.matt, async (q) => (await q("select count(*)::int as n from brands")).rows[0].n);
    expect(n).toBe(7);
  });

  it("members only see brands they were added to", async () => {
    const ids = await asUser(users.cece, async (q) =>
      (await q("select id from brands order by id")).rows.map((r: { id: string }) => r.id),
    );
    expect(ids).toEqual([BRAND_HSS, BRAND_SD]);
  });

  it("members don't see campaigns or deals of other brands", async () => {
    const res = await asUser(users.content, async (q) => ({
      campaigns: (await q("select brand_id from campaigns")).rows,
      deals: (await q("select brand_id from deals")).rows,
    }));
    expect(res.campaigns.every((r: { brand_id: string }) => r.brand_id === BRAND_HSS)).toBe(true);
    expect(res.deals.length).toBe(2);
    expect(res.deals.every((r: { brand_id: string }) => r.brand_id === BRAND_HSS)).toBe(true);
  });

  it("people outside the org see nothing", async () => {
    const res = await asUser(users.outsider, async (q) => ({
      orgs: (await q("select * from organizations")).rowCount,
      brands: (await q("select * from brands")).rowCount,
      creators: (await q("select * from creators")).rowCount,
      deals: (await q("select * from deals")).rowCount,
    }));
    expect(res).toEqual({ orgs: 0, brands: 0, creators: 0, deals: 0 });
  });
});

describe("write permissions", () => {
  it("only admins can create brands", async () => {
    // RETURNING matters: the app reads the new id back, which runs the SELECT policy on the new row.
    const id = await asUser(users.matt, async (q) =>
      (await q("insert into brands (org_id, name, slug) values ($1, 'Test Brand', 'test-brand') returning id", [ORG])).rows[0].id,
    );
    expect(id).toBeTruthy();
    await expectDenied(
      asUser(users.cece, (q) => q("insert into brands (org_id, name, slug) values ($1, 'Nope', 'nope')", [ORG])),
    );
  });

  it("brand editors can create campaigns only for their brands", async () => {
    await asUser(users.cece, (q) => q("insert into campaigns (brand_id, name) values ($1, 'Mine') returning id", [BRAND_HSS]));
    await expectDenied(
      asUser(users.cece, (q) => q("insert into campaigns (brand_id, name) values ($1, 'Not mine')", [BRAND_DJ])),
    );
  });

  it("viewers cannot edit campaigns or the creator roster", async () => {
    const updated = await asUser(users.content, async (q) =>
      (await q("update campaigns set name = 'hacked' where id = $1", [CAMPAIGN_HSS])).rowCount,
    );
    expect(updated).toBe(0);
    await expectDenied(
      asUser(users.content, (q) => q("insert into creators (org_id, name) values ($1, 'X')", [ORG])),
    );
  });

  it("editors can add creators to the shared roster", async () => {
    await asUser(users.cece, (q) => q("insert into creators (org_id, name) values ($1, 'New Creator')", [ORG]));
  });

  it("nobody can write integration health or api logs directly", async () => {
    await expectDenied(
      asUser(users.matt, (q) =>
        q("insert into integration_health (org_id, integration, status) values ($1, 'shopify', 'connected')", [ORG]),
      ),
    );
    await expectDenied(
      asUser(users.matt, (q) => q("insert into api_logs (org_id, platform, endpoint) values ($1, 'x', '/y')", [ORG])),
    );
  });

  it("members cannot promote themselves to admin", async () => {
    const n = await asUser(users.cece, async (q) =>
      (await q("update org_members set role = 'admin' where user_id = $1", [users.cece])).rowCount,
    );
    expect(n).toBe(0);
  });
});

describe("data integrity", () => {
  it("dedupes creator accounts on platform + handle", async () => {
    await expect(
      asUser(users.matt, (q) =>
        q("insert into creator_accounts (creator_id, org_id, platform, handle) values ($1, $2, 'instagram', 'jaketorque_fake')", [
          CREATOR_ROSA,
          ORG,
        ]),
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it("rejects un-normalized handles", async () => {
    await expect(
      asUser(users.matt, (q) =>
        q("insert into creator_accounts (creator_id, org_id, platform, handle) values ($1, $2, 'tiktok', '@Rosa')", [
          CREATOR_ROSA,
          ORG,
        ]),
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("forces a deal's brand_id to match its campaign", async () => {
    const brand = await asUser(users.matt, async (q) => {
      const { rows } = await q(
        "insert into deals (campaign_id, brand_id, creator_id) values ($1, $2, $3) returning brand_id",
        [CAMPAIGN_HSS, BRAND_DJ, CREATOR_ROSA],
      );
      return rows[0].brand_id;
    });
    expect(brand).toBe(BRAND_HSS);
  });

  it("requires a discount code when auto-creating a Shopify discount, and marks it pending", async () => {
    await expect(
      asUser(users.matt, (q) =>
        q("insert into deals (campaign_id, brand_id, creator_id, create_shopify_discount) values ($1, $2, $3, true)", [
          CAMPAIGN_HSS,
          BRAND_HSS,
          CREATOR_ROSA,
        ]),
      ),
    ).rejects.toThrow(/discount code is required/);

    const status = await asUser(users.matt, async (q) => {
      const { rows } = await q(
        "insert into deals (campaign_id, brand_id, creator_id, create_shopify_discount, discount_code) values ($1, $2, $3, true, 'ROSA5') returning shopify_discount_status",
        [CAMPAIGN_HSS, BRAND_HSS, CREATOR_ROSA],
      );
      return rows[0].shopify_discount_status;
    });
    expect(status).toBe("pending");
  });

  it("rejects a discount code already used by another deal for the same brand", async () => {
    await expect(
      asUser(users.matt, (q) =>
        q("insert into deals (campaign_id, brand_id, creator_id, discount_code) values ($1, $2, $3, 'JAKE15')", [
          CAMPAIGN_HSS,
          BRAND_HSS,
          CREATOR_ROSA,
        ]),
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it("does not let a creator from another org be attached to a deal", async () => {
    await db.query("begin");
    try {
      const { rows: org } = await db.query("insert into organizations (name) values ('Other') returning id");
      const { rows: c } = await db.query("insert into creators (org_id, name) values ($1, 'Foreign') returning id", [
        org[0].id,
      ]);
      await expect(
        db.query("insert into deals (campaign_id, brand_id, creator_id) values ($1, $2, $3)", [
          CAMPAIGN_HSS,
          BRAND_HSS,
          c[0].id,
        ]),
      ).rejects.toThrow(/same organization/);
    } finally {
      await db.query("rollback");
    }
  });

  it("keeps creator_accounts.org_id in sync with its creator", async () => {
    await db.query("begin");
    try {
      const { rows: org } = await db.query("insert into organizations (name) values ('Other') returning id");
      const { rows } = await db.query(
        "insert into creator_accounts (creator_id, org_id, platform, handle) values ($1, $2, 'youtube', 'jake_yt') returning org_id",
        [CREATOR_JAKE, org[0].id],
      );
      expect(rows[0].org_id).toBe(ORG);
    } finally {
      await db.query("rollback");
    }
  });
});

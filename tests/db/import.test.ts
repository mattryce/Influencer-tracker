import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { parseCreatorCsv, planCreatorImport, type ExistingAccount } from "@/lib/creators/csv-import";

// End-to-end acceptance for P0 #2: importing a 50-row CSV creates creators and accounts with dedupe on handle.
const ORG = "00000000-0000-4000-8000-000000000001";
const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
let cece: string;

beforeAll(async () => {
  await db.connect();
  const { rows } = await db.query("select id from profiles where email = 'cece@example.com'");
  cece = rows[0]?.id ?? (await db.query("insert into auth.users (email) values ('cece@example.com') returning id")).rows[0].id;
});
afterAll(() => db.end());

async function asCece<T>(fn: () => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: cece, role: "authenticated" })]);
    return await fn();
  } finally {
    await db.query("rollback");
  }
}

describe("import_creators RPC", () => {
  it("imports the 50-row fixture, merging into existing creators and deduping handles", async () => {
    await asCece(async () => {
      const before = (await db.query("select count(*)::int n from creators")).rows[0].n;
      const existing: ExistingAccount[] = (
        await db.query(
          "select a.creator_id, c.name as creator_name, a.platform, a.handle from creator_accounts a join creators c on c.id = a.creator_id",
        )
      ).rows;
      const plan = planCreatorImport(parseCreatorCsv(readFileSync("tests/fixtures/creators-50.csv", "utf8")).rows, existing);
      const { rows } = await db.query("select public.import_creators($1, $2) as r", [ORG, JSON.stringify(plan)]);
      expect(rows[0].r).toMatchObject({ created: 45, merged: 1, skipped_accounts: [] });

      const after = (await db.query("select count(*)::int n from creators")).rows[0].n;
      expect(after - before).toBe(45);

      const jake = (
        await db.query(
          "select c.email, array_agg(a.platform || ':' || a.handle order by a.platform, a.handle) accts from creators c join creator_accounts a on a.creator_id = c.id where c.id = '20000000-0000-4000-8000-000000000001' group by c.email",
        )
      ).rows[0];
      // Existing email kept, new TikTok handle attached.
      expect(jake.email).toBe("jake@example.com");
      expect(jake.accts).toEqual(["instagram:jaketorque_fake", "tiktok:jaketorque_fake", "tiktok:jaketorque_new"]);

      // Importing the same file twice creates nothing new for people with handles.
      const existing2: ExistingAccount[] = (
        await db.query(
          "select a.creator_id, c.name as creator_name, a.platform, a.handle from creator_accounts a join creators c on c.id = a.creator_id",
        )
      ).rows;
      const plan2 = planCreatorImport(parseCreatorCsv(readFileSync("tests/fixtures/creators-50.csv", "utf8")).rows, existing2);
      expect(plan2.creates).toHaveLength(0);
    });
  });

  it("is refused for viewers", async () => {
    await db.query("begin");
    try {
      const { rows } = await db.query("select id from profiles where email = 'content@example.com'");
      const viewer = rows[0]?.id ?? (await db.query("insert into auth.users (email) values ('content@example.com') returning id")).rows[0].id;
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: viewer, role: "authenticated" })]);
      await expect(
        db.query("select public.import_creators($1, $2)", [ORG, JSON.stringify({ creates: [{ name: "X", tags: [], accounts: [] }] })]),
      ).rejects.toThrow(/row-level security/);
    } finally {
      await db.query("rollback");
    }
  });
});

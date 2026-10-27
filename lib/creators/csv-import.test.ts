import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCreatorCsv, planCreatorImport, type ExistingAccount } from "./csv-import";

const fixture = readFileSync(new URL("../../tests/fixtures/creators-50.csv", import.meta.url), "utf8");

const existing: ExistingAccount[] = [
  { creator_id: "jake", creator_name: "Jake Torque", platform: "instagram", handle: "jaketorque_fake" },
  { creator_id: "jake", creator_name: "Jake Torque", platform: "tiktok", handle: "jaketorque_fake" },
  { creator_id: "rosa", creator_name: "Rosa Builds", platform: "youtube", handle: "rosabuilds_fake" },
];

describe("parseCreatorCsv", () => {
  it("maps headers case-insensitively and reads all 50 rows", () => {
    const parsed = parseCreatorCsv(fixture);
    expect(parsed.rows).toHaveLength(50);
    expect(parsed.missingName).toBe(false);
    expect(parsed.unknownColumns).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      rowNumber: 2,
      name: "Creator 01",
      email: "creator01@example.com",
      tags: ["diesel", "trucks"],
      handles: { instagram: "creator01" },
    });
  });

  it("accepts header aliases, a BOM and reports unknown columns", () => {
    const parsed = parseCreatorCsv("﻿Full Name,IG,TT,Followers\nA,@a1,@a1,100\n");
    expect(parsed.rows[0]).toMatchObject({ name: "A", handles: { instagram: "@a1", tiktok: "@a1" } });
    expect(parsed.unknownColumns).toEqual(["Followers"]);
  });

  it("flags a file without a name column", () => {
    expect(parseCreatorCsv("instagram\nfoo\n").missingName).toBe(true);
  });
});

describe("planCreatorImport (50-row acceptance fixture)", () => {
  const plan = planCreatorImport(parseCreatorCsv(fixture).rows, existing);

  it("creates one creator per unique person", () => {
    // 44 distinct creators + "Bad Handle Person"; rows 45-47 fold into earlier rows; 48 merges; 49 errors.
    expect(plan.creates).toHaveLength(45);
  });

  it("combines rows in the same file that share a handle", () => {
    const c1 = plan.creates.find((c) => c.name === "Creator 01")!;
    expect(c1.rowNumbers).toEqual([2, 46]);
    expect(c1.tags).toEqual(["diesel", "trucks", "ugc"]);
    const c2 = plan.creates.find((c) => c.name === "Creator 02")!;
    expect(c2.rowNumbers).toEqual([3, 47]);
    const c3 = plan.creates.find((c) => c.name === "Creator 03")!;
    expect(c3.rowNumbers).toEqual([4, 48]);
    expect(c3.accounts).toEqual([
      { platform: "instagram", handle: "creator03", profile_url: "https://www.instagram.com/creator03/" },
    ]);
  });

  it("merges rows that match an existing creator's handle instead of duplicating", () => {
    expect(plan.merges).toHaveLength(1);
    expect(plan.merges[0]).toMatchObject({
      creator_id: "jake",
      rowNumbers: [49],
      email: "jake2@example.com",
      accounts: [{ platform: "tiktok", handle: "jaketorque_new" }],
    });
  });

  it("never plans the same handle twice", () => {
    const all = [...plan.creates, ...plan.merges].flatMap((c) => c.accounts.map((a) => `${a.platform}:${a.handle}`));
    expect(new Set(all).size).toBe(all.length);
    for (const e of existing) expect(all).not.toContain(`${e.platform}:${e.handle}`);
  });

  it("reports rows it couldn't import and handles it dropped", () => {
    expect(plan.errors).toEqual([{ rowNumber: 50, message: "Missing name" }]);
    const bad = plan.creates.find((c) => c.name === "Bad Handle Person")!;
    expect(bad.accounts.map((a) => a.handle)).toEqual(["badhandle_ok"]);
    expect(plan.warnings.some((w) => w.rowNumber === 51 && /not a handle!/.test(w.message))).toBe(true);
  });

  it("rejects a row whose handles belong to two different existing creators", () => {
    const p = planCreatorImport(
      [{ rowNumber: 2, name: "X", email: null, phone: null, tags: [], notes: null, handles: { instagram: "jaketorque_fake", youtube: "rosabuilds_fake" } }],
      existing,
    );
    expect(p.creates).toHaveLength(0);
    expect(p.merges).toHaveLength(0);
    expect(p.errors[0].message).toMatch(/Jake Torque and Rosa Builds/);
  });
});

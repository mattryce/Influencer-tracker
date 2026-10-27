import { describe, expect, it } from "vitest";
import { validateCampaign, validateDeal } from "./validate";

describe("validateCampaign", () => {
  it("normalizes hashtags/mentions and budget", () => {
    const r = validateCampaign({
      brand_id: "b",
      name: " Winter ",
      status: "active",
      starts_on: "2026-11-01",
      ends_on: "2026-12-01",
      budget: "$5,000",
      required_hashtags: "#HotShot #ad",
      required_mentions: "@HotShotSecret",
    });
    expect(r.value).toMatchObject({ name: "Winter", budget: 5000, required_hashtags: ["hotshot", "ad"], required_mentions: ["hotshotsecret"] });
  });

  it("rejects an end date before the start", () => {
    const r = validateCampaign({ brand_id: "b", name: "x", starts_on: "2026-12-01", ends_on: "2026-11-01" });
    expect(r.fieldErrors.ends_on).toMatch(/before/);
  });
});

describe("validateDeal", () => {
  it("parses money, deliverables and normalizes code/utm", () => {
    const r = validateDeal({
      creator_id: "c",
      fee: "$1,250.50",
      product_value: "",
      deliverables: "2 reels + 3 stories",
      discount_code: "jake15",
      utm_tag: "JakeTorque",
      create_shopify_discount: "on",
    });
    expect(r.value).toMatchObject({
      fee: 1250.5,
      product_value: 0,
      discount_code: "JAKE15",
      utm_tag: "jaketorque",
      create_shopify_discount: true,
      status: "proposed",
    });
    expect(r.value?.deliverables).toHaveLength(2);
  });

  it("requires a code when auto-creating a Shopify discount", () => {
    expect(validateDeal({ creator_id: "c", create_shopify_discount: "on" }).fieldErrors.discount_code).toBeDefined();
  });

  it("rejects bad input with field-level messages", () => {
    const r = validateDeal({ creator_id: "", fee: "abc", discount_code: "has space", deliverables: "1 podcast" });
    expect(Object.keys(r.fieldErrors).sort()).toEqual(["creator_id", "deliverables", "discount_code", "fee"]);
  });
});

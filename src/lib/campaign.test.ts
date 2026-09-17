import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CAMPAIGN_LINKS, campaignSourceToHeardAbout, readCampaignFromSearch } from "./campaign.ts";

describe("readCampaignFromSearch", () => {
  it("parses a campaign link", () => {
    const c = readCampaignFromSearch(
      "?utm_source=linkedin&utm_medium=social&utm_campaign=founding-shops&utm_content=week1-launch",
      "https://www.linkedin.com/feed/",
    );
    assert.ok(c);
    assert.equal(c.utm_source, "linkedin");
    assert.equal(c.utm_medium, "social");
    assert.equal(c.utm_campaign, "founding-shops");
    assert.equal(c.utm_content, "week1-launch");
    assert.equal(c.utm_term, null);
    assert.equal(c.landing_referrer, "https://www.linkedin.com/feed/");
  });

  it("returns null without campaign params", () => {
    assert.equal(readCampaignFromSearch("?foo=bar"), null);
    assert.equal(readCampaignFromSearch(""), null);
  });

  it("trims and caps values", () => {
    const c = readCampaignFromSearch(`?utm_source=${" x".repeat(200).trim()}`);
    assert.ok(c);
    assert.ok((c.utm_source ?? "").length <= 120);
  });
});

describe("campaignSourceToHeardAbout", () => {
  it("maps known sources", () => {
    assert.equal(campaignSourceToHeardAbout("LinkedIn"), "linkedin");
    assert.equal(campaignSourceToHeardAbout("ig"), "instagram");
    assert.equal(campaignSourceToHeardAbout("meta"), "facebook");
    assert.equal(campaignSourceToHeardAbout("google_ads"), "google");
    assert.equal(campaignSourceToHeardAbout("newsletter"), null);
    assert.equal(campaignSourceToHeardAbout(null), null);
  });
});

describe("CAMPAIGN_LINKS", () => {
  it("covers the launch channels plus the Zeely ad", () => {
    assert.deepEqual(
      CAMPAIGN_LINKS.map((l) => l.source),
      ["linkedin", "instagram", "facebook", "zeely"],
    );
    for (const link of CAMPAIGN_LINKS) {
      assert.ok(link.path.startsWith("/owners?utm_source="));
      assert.ok(link.path.includes("utm_campaign="));
    }
  });

  it("tags the Zeely link as paid social with its own campaign", () => {
    const zeely = CAMPAIGN_LINKS.find((l) => l.source === "zeely");
    assert.ok(zeely);
    assert.ok(zeely.path.includes("utm_medium=paid_social"));
    assert.ok(zeely.path.includes("utm_campaign=zeely-90day-trial"));
  });
});


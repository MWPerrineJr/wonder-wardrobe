import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PROVIDER_FROZEN_FIELDS, ProviderSelfPatch } from "./provider-profile.ts";

describe("provider self-edit schema", () => {
  it("accepts display fields only", () => {
    const parsed = ProviderSelfPatch.parse({
      displayName: "Alex Rivera",
      bio: "Color and cuts",
      specialties: ["color"],
    });
    assert.equal(parsed.displayName, "Alex Rivera");
  });

  it("rejects frozen identity and shop fields", () => {
    for (const field of PROVIDER_FROZEN_FIELDS) {
      assert.throws(() => ProviderSelfPatch.parse({ [field]: "tampered" }));
    }
    assert.throws(() => ProviderSelfPatch.parse({ shopId: "00000000-0000-0000-0000-000000000001" }));
    assert.throws(() => ProviderSelfPatch.parse({ userId: "00000000-0000-0000-0000-000000000001" }));
    assert.throws(() => ProviderSelfPatch.parse({ isActive: false }));
  });
});

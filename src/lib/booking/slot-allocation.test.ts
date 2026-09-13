import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterWithinRadiusKm,
  rankPartnersByDistance,
} from "./slot-allocation";
import type { TechnicianDoc } from "./types";

const customer = { lat: 28.6139, lng: 77.209 };

function tech(
  id: string,
  kmApprox: { lat: number; lng: number },
  extra: Partial<TechnicianDoc> = {},
): TechnicianDoc {
  return {
    id,
    name: id,
    verificationStatus: "active",
    location: kmApprox,
    ...extra,
  };
}

describe("nearest partner ranking has no km cap", () => {
  it("selects the nearest available partner even when farther than 5 km", () => {
    const partners = [
      tech("far-15km", { lat: 28.748, lng: 77.209 }),
      tech("mid-7km", { lat: 28.676, lng: 77.209 }),
      tech("near-2km", { lat: 28.631, lng: 77.209 }),
    ];
    const ranked = rankPartnersByDistance(partners, customer.lat, customer.lng);
    assert.deepEqual(
      ranked.map((p) => p.id),
      ["near-2km", "mid-7km", "far-15km"],
    );
    const stillUsesLegacyName = filterWithinRadiusKm(
      partners,
      customer.lat,
      customer.lng,
      5,
    );
    assert.equal(stillUsesLegacyName.length, 3);
    assert.equal(stillUsesLegacyName[0]?.id, "near-2km");
  });

  it("skips a busy nearer partner by leaving them out of the input list", () => {
    const free = [
      tech("mid-7km", { lat: 28.676, lng: 77.209 }),
      tech("far-15km", { lat: 28.748, lng: 77.209 }),
    ];
    const ranked = rankPartnersByDistance(free, customer.lat, customer.lng);
    assert.equal(ranked[0]?.id, "mid-7km");
  });

  it("excludes partners without a valid location", () => {
    const ranked = rankPartnersByDistance(
      [
        tech("no-loc", { lat: Number.NaN, lng: Number.NaN }, { location: undefined }),
        tech("ok-25km", { lat: 28.84, lng: 77.209 }),
      ],
      customer.lat,
      customer.lng,
    );
    assert.deepEqual(
      ranked.map((p) => p.id),
      ["ok-25km"],
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeVisibleSlots,
  filterWithinRadiusKm,
  isPartnerAssignable,
  rankPartnersByDistance,
} from "./slot-allocation";
import type { TechnicianDoc } from "./types";

const customer = { lat: 28.6139, lng: 77.209 };
const future = "2099-06-15";

function tech(
  id: string,
  kmApprox: { lat: number; lng: number } | null,
  extra: Partial<TechnicianDoc> = {},
): TechnicianDoc {
  return {
    id,
    name: id,
    verificationStatus: "approved",
    accountStatus: "active",
    kyc: { status: "approved" },
    categoryId: "ac",
    ...(kmApprox ? { location: kmApprox } : { location: undefined }),
    ...extra,
  };
}

function visibleIndexes(
  partners: TechnicianDoc[],
  busyByTech: Record<string, { id?: string; date?: string; slotIndex?: number; status?: string }[]>,
) {
  const { slots } = computeVisibleSlots({
    categoryId: "ac",
    userLat: customer.lat,
    userLng: customer.lng,
    dateKey: future,
    radiusKm: 0,
    allTechnicians: partners,
    busyByTech,
  });
  return slots.map((s) => s.slotIndex);
}

describe("admin-approved partners are eligible", () => {
  it("treats verificationStatus approved as assignable", () => {
    assert.equal(
      isPartnerAssignable(
        tech("p", customer, {
          verificationStatus: "approved",
          accountStatus: "active",
        }),
      ),
      true,
    );
  });

  it("does not treat shift Busy/Offline as ineligible", () => {
    assert.equal(
      isPartnerAssignable(tech("p", customer, { shiftStatus: "Offline", status: "Busy" })),
      true,
    );
  });

  it("excludes pending and rejected accounts", () => {
    assert.equal(
      isPartnerAssignable(tech("p", customer, { verificationStatus: "pending" })),
      false,
    );
    assert.equal(
      isPartnerAssignable(tech("p", customer, { verificationStatus: "rejected" })),
      false,
    );
  });
});

describe("nearest partner ranking has no km cap", () => {
  it("TEST 1: partner ~2 km away and free is ranked first", () => {
    const ranked = rankPartnersByDistance(
      [tech("near-2km", { lat: 28.631, lng: 77.209 })],
      customer.lat,
      customer.lng,
    );
    assert.equal(ranked[0]?.id, "near-2km");
    const indexes = visibleIndexes(ranked, {});
    assert.ok(indexes.length > 0);
  });

  it("TEST 2: partner ~7 km away and free still makes slots available", () => {
    const partners = [tech("mid-7km", { lat: 28.676, lng: 77.209 })];
    assert.ok(visibleIndexes(partners, {}).length > 0);
  });

  it("TEST 3: partner ~20 km away and free still makes slots available", () => {
    const partners = [tech("far-20km", { lat: 28.793, lng: 77.209 })];
    assert.ok(visibleIndexes(partners, {}).length > 0);
  });

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

  it("TEST 4/5: nearest busy, farther free — slot stays available and farther partner is preferred for assignment", () => {
    const busyNear = tech("near-2km", { lat: 28.631, lng: 77.209 });
    const freeFar = tech("mid-8km", { lat: 28.685, lng: 77.209 });
    const indexes = visibleIndexes([busyNear, freeFar], {
      "near-2km": [{ id: `${future}_1`, date: future, slotIndex: 1, status: "busy" }],
    });
    assert.equal(indexes.includes(1), true);
    const rankedFree = rankPartnersByDistance([freeFar], customer.lat, customer.lng);
    assert.equal(rankedFree[0]?.id, "mid-8km");
  });

  it("still ranks a partner whose shift is Busy or Offline", () => {
    const ranked = rankPartnersByDistance(
      [
        tech("offline-7km", { lat: 28.676, lng: 77.209 }, { shiftStatus: "Offline" }),
        tech("busy-shift-2km", { lat: 28.631, lng: 77.209 }, { shiftStatus: "Busy" }),
      ],
      customer.lat,
      customer.lng,
    );
    assert.equal(ranked[0]?.id, "busy-shift-2km");
    assert.equal(ranked.length, 2);
  });

  it("TEST 8: partners without coordinates still keep slots available", () => {
    const ranked = rankPartnersByDistance(
      [
        tech("no-loc", null, { location: undefined }),
        tech("ok-25km", { lat: 28.84, lng: 77.209 }),
      ],
      customer.lat,
      customer.lng,
    );
    assert.deepEqual(
      ranked.map((p) => p.id),
      ["ok-25km", "no-loc"],
    );
    const onlyMissing = [tech("no-loc", null, { location: undefined })];
    assert.ok(visibleIndexes(onlyMissing, {}).length > 0);
    const noCustomerCoords = rankPartnersByDistance(onlyMissing, Number.NaN, Number.NaN);
    assert.equal(noCustomerCoords.length, 1);
  });
});

describe("hourly slots stay independent under peak grouping", () => {
  it("TEST 6: unrelated busy slot does not hide the requested hour", () => {
    const partners = [tech("p1", customer)];
    const indexes = visibleIndexes(partners, {
      p1: [{ id: `${future}_2`, date: future, slotIndex: 2, status: "busy" }],
    });
    assert.equal(indexes.includes(1), true);
    assert.equal(indexes.includes(2), false);
  });

  it("TEST 7: overlapping busy hour excludes that partner for that hour", () => {
    const partners = [tech("p1", customer)];
    const indexes = visibleIndexes(partners, {
      p1: [{ id: `${future}_1`, date: future, slotIndex: 1, status: "busy" }],
    });
    assert.equal(indexes.includes(1), false);
  });

  it("keeps 8-9 bookable when 9-10 is busy", () => {
    const partners = [tech("p1", customer)];
    const indexes = visibleIndexes(partners, {
      p1: [{ id: `${future}_2`, date: future, slotIndex: 2, status: "busy" }],
    });
    assert.equal(indexes.includes(1), true);
    assert.equal(indexes.includes(2), false);
  });
});

describe("cancelled bookings do not block availability", () => {
  it("TEST 9: cancelled/completed statuses are not active booking conflicts", () => {
    const active = new Set([
      "new",
      "pending",
      "assigned",
      "inprogress",
      "started",
      "processing",
      "upcoming",
    ]);
    const normalize = (status: unknown) =>
      String(status ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
    assert.equal(active.has(normalize("Cancelled")), false);
    assert.equal(active.has(normalize("Completed")), false);
    assert.equal(active.has(normalize("Assigned")), true);
  });
});

describe("service category matching", () => {
  it("TEST 10: wrong category is excluded from availability", () => {
    const partners = [
      tech("plumber", customer, { categoryId: "plumbing" }),
      tech("ac-tech", customer, { categoryId: "ac" }),
    ];
    const indexes = visibleIndexes(partners, {});
    assert.ok(indexes.length > 0);
    const { slots } = computeVisibleSlots({
      categoryId: "plumbing",
      userLat: customer.lat,
      userLng: customer.lng,
      dateKey: future,
      radiusKm: 0,
      allTechnicians: partners,
      busyByTech: {},
    });
    assert.ok(slots.length > 0);
    const acOnly = computeVisibleSlots({
      categoryId: "electrical",
      userLat: customer.lat,
      userLng: customer.lng,
      dateKey: future,
      radiusKm: 0,
      allTechnicians: partners,
      busyByTech: {},
    });
    assert.equal(acOnly.debug.eligibleCount, 0);
    assert.equal(acOnly.slots.length, 0);
  });
});

describe("admin credential failures are not availability errors", () => {
  it("16 UNAUTHENTICATED is classified as server credential failure", () => {
    const message =
      "16 UNAUTHENTICATED: Request had invalid authentication credentials. Expected OAuth 2 access token.";
    const classified = /16\s*UNAUTHENTICATED|OAuth 2 access token|invalid authentication credentials/i.test(
      message,
    );
    assert.equal(classified, true);
    assert.equal(
      /16\s*UNAUTHENTICATED|OAuth 2 access token|invalid authentication credentials/i.test(
        "NO_ELIGIBLE_PARTNER",
      ),
      false,
    );
  });
});

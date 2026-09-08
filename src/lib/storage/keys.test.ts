import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInvoiceDrivePath,
  buildInvoiceKey,
  buildPublicImageKey,
  isCloudinaryUrl,
  slugifyName,
} from "./keys";

describe("slugifyName", () => {
  it("sanitizes service names", () => {
    assert.equal(slugifyName("AC Repair & Service"), "ac-repair-and-service");
    assert.equal(slugifyName("Refrigerator / Deep Clean!!!"), "refrigerator-deep-clean");
    assert.equal(slugifyName(""), "item");
  });
});

describe("buildPublicImageKey", () => {
  it("keeps customer and partner profiles in separate folders", () => {
    assert.equal(
      buildPublicImageKey({
        kind: "profile-user",
        ownerId: "cust_1",
        contentType: "image/webp",
      }),
      "repair-series/profiles/customers/cust_1/profile",
    );
    assert.equal(
      buildPublicImageKey({
        kind: "profile-partner",
        ownerId: "tech_1",
        contentType: "image/jpeg",
      }),
      "repair-series/profiles/partners/tech_1/profile",
    );
  });

  it("nests service images under a sanitized name plus id", () => {
    const key = buildPublicImageKey({
      kind: "service",
      serviceName: "AC Repair & Service",
      serviceId: "svc99",
      slot: "detail",
      contentType: "image/webp",
    });
    assert.match(
      key,
      /^repair-series\/services\/ac-repair-and-service\/svc99\/detail-[a-z0-9]+$/,
    );
  });

  it("uses banner section folders", () => {
    const key = buildPublicImageKey({
      kind: "banner",
      section: "home",
      bannerId: "ban1",
      slot: "website",
      contentType: "image/png",
    });
    assert.match(
      key,
      /^repair-series\/banners\/home\/ban1-website-[a-z0-9]+$/,
    );
  });

  it("rejects unsafe owner ids", () => {
    assert.equal(
      buildPublicImageKey({
        kind: "profile-user",
        ownerId: "../etc/passwd",
      }),
      "repair-series/profiles/customers/etc-passwd/profile",
    );
  });
});

describe("buildInvoiceDrivePath", () => {
  it("groups invoices by year and month using the invoice number", () => {
    const path = buildInvoiceDrivePath({
      invoiceNumber: "INV-20260905-abc",
      bookingId: "abc",
      now: new Date(2026, 8, 5, 10, 0, 0),
    });
    assert.deepEqual(path, {
      year: "2026",
      month: "09",
      fileName: "INV-20260905-abc.pdf",
    });
  });
});

describe("buildInvoiceKey", () => {
  it("keeps a path-shaped label for logs without customer folders", () => {
    const key = buildInvoiceKey({
      customerId: "custA",
      invoiceNumber: "INV-20260905-abc",
      bookingId: "abc",
      now: new Date(2026, 8, 5, 10, 0, 0),
    });
    assert.equal(key, "invoices/2026/09/INV-20260905-abc.pdf");
  });
});

describe("isCloudinaryUrl", () => {
  it("detects Cloudinary delivery URLs", () => {
    assert.equal(
      isCloudinaryUrl("https://res.cloudinary.com/demo/image/upload/x.jpg"),
      true,
    );
    assert.equal(isCloudinaryUrl("https://media.example.com/services/x.webp"), false);
  });
});

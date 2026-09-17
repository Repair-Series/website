import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInvoiceKey,
  buildInvoiceStoragePath,
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

describe("buildInvoiceStoragePath", () => {
  it("groups invoices by year and month using the invoice number", () => {
    const path = buildInvoiceStoragePath({
      invoiceNumber: "INV-20260905-abc",
      bookingId: "abc",
      now: new Date(2026, 8, 5, 10, 0, 0),
    });
    assert.deepEqual(path, {
      folder: "repair-series/invoices/2026/09",
      publicId: "INV-20260905-abc",
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
    assert.equal(key, "repair-series/invoices/2026/09/INV-20260905-abc.pdf");
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

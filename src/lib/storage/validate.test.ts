import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateImageBuffer, validatePdfBuffer } from "./validate";

describe("validateImageBuffer", () => {
  it("accepts JPEG magic bytes", () => {
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    assert.equal(validateImageBuffer(jpeg).contentType, "image/jpeg");
  });

  it("rejects empty and unknown files", () => {
    assert.throws(() => validateImageBuffer(Buffer.alloc(0)), /Empty/);
    assert.throws(() => validateImageBuffer(Buffer.from("hello")), /JPEG, PNG, or WebP/);
  });
});

describe("validatePdfBuffer", () => {
  it("accepts PDF magic", () => {
    assert.doesNotThrow(() => validatePdfBuffer(Buffer.from("%PDF-1.4\n%")));
  });

  it("rejects non-PDF", () => {
    assert.throws(() => validatePdfBuffer(Buffer.from("not-a-pdf")), /Invalid PDF/);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatNationalInput,
  normalizeStoredPhone,
  parseIndiaMobile,
  phoneLookupValues,
} from "./phone";
import { mapPhoneAuthError } from "./phone-errors";

describe("India phone parse", () => {
  it("accepts 10-digit mobile starting 6-9", () => {
    const parsed = parseIndiaMobile("9876543210");
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.e164, "+919876543210");
      assert.equal(parsed.national, "9876543210");
    }
  });

  it("normalizes +91, 91, and leading 0", () => {
    assert.equal(normalizeStoredPhone("+91 98765 43210"), "+919876543210");
    assert.equal(normalizeStoredPhone("919876543210"), "+919876543210");
    assert.equal(normalizeStoredPhone("09876543210"), "+919876543210");
  });

  it("rejects empty, short, long, and invalid prefixes", () => {
    assert.equal(parseIndiaMobile("").ok, false);
    assert.equal(parseIndiaMobile("98765").ok, false);
    assert.equal(parseIndiaMobile("987654321012").ok, false);
    assert.equal(parseIndiaMobile("1876543210").ok, false);
  });

  it("builds lookup variants for legacy stored formats", () => {
    const values = phoneLookupValues("+919876543210");
    assert.ok(values.includes("+919876543210"));
    assert.ok(values.includes("9876543210"));
    assert.ok(values.includes("919876543210"));
  });

  it("limits national input to 10 digits", () => {
    assert.equal(formatNationalInput("98a7654321099"), "9876543210");
  });
});

describe("phone auth errors", () => {
  it("maps invalid and expired OTP codes", () => {
    assert.equal(
      mapPhoneAuthError({ code: "auth/invalid-verification-code" }),
      "Invalid OTP. Please check the code and try again.",
    );
    assert.equal(
      mapPhoneAuthError({ code: "auth/code-expired" }),
      "This OTP has expired. Request a new code.",
    );
    assert.match(
      mapPhoneAuthError({ code: "auth/too-many-requests" }),
      /Too many OTP requests/,
    );
    assert.match(
      mapPhoneAuthError(new Error("CAPTCHA_CHECK_FAILED")),
      /Verification check failed/,
    );
    assert.equal(
      mapPhoneAuthError({ code: "auth/invalid-phone-number", message: "INVALID_PHONE_NUMBER : Invalid format." }),
      "Invalid phone number.",
    );
    assert.match(
      mapPhoneAuthError({ code: "auth/billing-not-enabled", message: "BILLING_NOT_ENABLED" }),
      /Blaze billing/,
    );
    assert.match(
      mapPhoneAuthError({ code: "auth/invalid-app-credential", message: "INVALID_APP_CREDENTIAL" }),
      /Authorized domains/,
    );
  });
});

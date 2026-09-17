import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  expectedFirebaseProjectId,
  getAdminCredentialDiagnostics,
  normalizePrivateKey,
  parseServiceAccount,
  privateKeyLooksValid,
} from "./admin";

const saved: Record<string, string | undefined> = {};
const keys = [
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
];

function snapshotEnv() {
  for (const k of keys) saved[k] = process.env[k];
}

function restoreEnv() {
  for (const k of keys) {
    if (saved[k] == null) delete process.env[k];
    else process.env[k] = saved[k];
  }
}

function clearAdminEnv() {
  for (const k of keys) delete process.env[k];
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "repair-series";
}

const pem = "-----BEGIN PRIVATE KEY-----\nMIIBPLACEHOLDER\n-----END PRIVATE KEY-----";

describe("Firebase Admin credential parsing", () => {
  beforeEach(() => {
    snapshotEnv();
    clearAdminEnv();
  });
  afterEach(() => restoreEnv());

  it("normalizes escaped newlines in private keys", () => {
    const raw = "-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----";
    const out = normalizePrivateKey(raw);
    assert.equal(out.includes("\nABC\n"), true);
    assert.equal(out.includes("\\n"), false);
    assert.equal(privateKeyLooksValid(out), true);
  });

  it("parses FIREBASE_SERVICE_ACCOUNT_JSON for project repair-series", () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: "service_account",
      project_id: "repair-series",
      client_email: "firebase-adminsdk-test@repair-series.iam.gserviceaccount.com",
      private_key: pem,
    });
    const sa = parseServiceAccount();
    assert.equal(sa?.source, "json");
    assert.equal(sa?.projectId, "repair-series");
    assert.equal(expectedFirebaseProjectId(), "repair-series");
    const diag = getAdminCredentialDiagnostics();
    assert.equal(diag.serviceAccountJsonExists, true);
    assert.equal(diag.parsed, true);
    assert.equal(diag.projectIdMatches, true);
    assert.equal(diag.parsedClientEmailDomain, "repair-series.iam.gserviceaccount.com");
    assert.equal(JSON.stringify(diag).includes("BEGIN PRIVATE KEY"), false);
    assert.equal(JSON.stringify(diag).includes("firebase-adminsdk-test"), false);
  });

  it("uses split env only when the private key looks like a PEM", () => {
    process.env.FIREBASE_CLIENT_EMAIL = "firebase-adminsdk-test@repair-series.iam.gserviceaccount.com";
    process.env.FIREBASE_PRIVATE_KEY = "not-a-key";
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: "service_account",
      project_id: "repair-series",
      client_email: "firebase-adminsdk-test@repair-series.iam.gserviceaccount.com",
      private_key: pem,
    });
    const sa = parseServiceAccount();
    assert.equal(sa?.source, "json");
  });

  it("returns null when JSON is missing required fields", () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: "repair-series",
    });
    assert.equal(parseServiceAccount(), null);
  });
});

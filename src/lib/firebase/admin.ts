import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import type { Messaging } from "firebase-admin/messaging";

const EXPECTED_PROJECT_ID = "repair-series";

function serverConfigError(message: string): never {
  throw Object.assign(new Error(message), {
    status: 503,
    code: "SERVER_CONFIGURATION_ERROR",
  });
}

function unwrapEnvJson(raw: string): string {
  let value = String(raw || "").trim();
  if (value.charCodeAt(0) === 0xfeff) value = value.slice(1);
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    value = value.slice(1, -1);
  }
  return value.trim();
}

export function expectedFirebaseProjectId(): string {
  const fromEnv = unwrapEnvJson(
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  );
  return fromEnv || EXPECTED_PROJECT_ID;
}

export function normalizePrivateKey(raw: string): string {
  return unwrapEnvJson(raw)
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

export function privateKeyLooksValid(key: string): boolean {
  const k = normalizePrivateKey(key);
  return /BEGIN [A-Z ]*PRIVATE KEY/.test(k) && /END [A-Z ]*PRIVATE KEY/.test(k);
}

export type ParsedAdminServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  source: "split" | "json";
};

function parseJsonServiceAccount(raw: string): Record<string, unknown> | null {
  const value = unwrapEnvJson(raw);
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    try {
      return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export function parseServiceAccount(): ParsedAdminServiceAccount | null {
  const splitEmail = unwrapEnvJson(process.env.FIREBASE_CLIENT_EMAIL || "");
  const splitKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY || "");
  const jsonRaw = unwrapEnvJson(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "");

  if (splitEmail && privateKeyLooksValid(splitKey)) {
    return {
      projectId: unwrapEnvJson(
        process.env.FIREBASE_PROJECT_ID ||
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
          EXPECTED_PROJECT_ID,
      ),
      clientEmail: splitEmail,
      privateKey: splitKey,
      source: "split",
    };
  }

  if (!jsonRaw) return null;
  const parsed = parseJsonServiceAccount(jsonRaw);
  if (!parsed) return null;
  const clientEmail = unwrapEnvJson(String(parsed.client_email || ""));
  const privateKey = normalizePrivateKey(String(parsed.private_key || ""));
  const projectId = unwrapEnvJson(
    String(
      parsed.project_id ||
        process.env.FIREBASE_PROJECT_ID ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
        "",
    ),
  );
  if (!clientEmail || !privateKeyLooksValid(privateKey) || !projectId) return null;
  return { projectId, clientEmail, privateKey, source: "json" };
}

export type AdminCredentialDiagnostics = {
  expectedProjectId: string;
  serviceAccountJsonExists: boolean;
  clientEmailEnvExists: boolean;
  privateKeyEnvExists: boolean;
  privateKeyEnvLength: number;
  parsed: boolean;
  parsedSource: "split" | "json" | "";
  parsedProjectId: string;
  parsedClientEmailExists: boolean;
  parsedClientEmailDomain: string;
  privateKeyExists: boolean;
  privateKeyLength: number;
  privateKeyLooksValid: boolean;
  projectIdMatches: boolean;
  adminAppInitialized: boolean;
};

let loggedDiagnostics = false;

export function getAdminCredentialDiagnostics(
  extra?: { adminAppInitialized?: boolean },
): AdminCredentialDiagnostics {
  const expectedProjectId = expectedFirebaseProjectId();
  const jsonRaw = unwrapEnvJson(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "");
  const splitEmail = unwrapEnvJson(process.env.FIREBASE_CLIENT_EMAIL || "");
  const splitKey = unwrapEnvJson(process.env.FIREBASE_PRIVATE_KEY || "");
  const parsed = parseServiceAccount();
  const privateKey = parsed?.privateKey || "";
  const domain = parsed?.clientEmail ? parsed.clientEmail.split("@")[1] || "" : "";
  return {
    expectedProjectId,
    serviceAccountJsonExists: Boolean(jsonRaw),
    clientEmailEnvExists: Boolean(splitEmail),
    privateKeyEnvExists: Boolean(splitKey),
    privateKeyEnvLength: splitKey.length,
    parsed: Boolean(parsed),
    parsedSource: parsed?.source || "",
    parsedProjectId: parsed?.projectId || "",
    parsedClientEmailExists: Boolean(parsed?.clientEmail),
    parsedClientEmailDomain: domain,
    privateKeyExists: Boolean(privateKey),
    privateKeyLength: privateKey.length,
    privateKeyLooksValid: privateKeyLooksValid(privateKey),
    projectIdMatches: parsed ? parsed.projectId === expectedProjectId : false,
    adminAppInitialized: extra?.adminAppInitialized === true,
  };
}

function logAdminDiagnostics(diag: AdminCredentialDiagnostics, firestoreAttempted = false) {
  if (loggedDiagnostics) return;
  loggedDiagnostics = true;
  console.info("[Firebase Admin]", {
    ...diag,
    firestoreConnectionAttempted: firestoreAttempted,
  });
}

function getAdminApp(): App {
  if (getApps().length) {
    logAdminDiagnostics(getAdminCredentialDiagnostics({ adminAppInitialized: true }));
    return getApps()[0]!;
  }
  const jsonRaw = unwrapEnvJson(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "");
  const splitEmail = unwrapEnvJson(process.env.FIREBASE_CLIENT_EMAIL || "");
  const splitKey = unwrapEnvJson(process.env.FIREBASE_PRIVATE_KEY || "");
  if (!jsonRaw && !(splitEmail && splitKey)) {
    logAdminDiagnostics(getAdminCredentialDiagnostics({ adminAppInitialized: false }));
    serverConfigError(
      "Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_CLIENT_EMAIL plus FIREBASE_PRIVATE_KEY.",
    );
  }
  const sa = parseServiceAccount();
  if (!sa) {
    logAdminDiagnostics(getAdminCredentialDiagnostics({ adminAppInitialized: false }));
    serverConfigError(
      "Firebase Admin credentials are present but invalid. Check FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_PRIVATE_KEY) parses as a service account with project_id, client_email, and a PEM private_key.",
    );
  }
  const expected = expectedFirebaseProjectId();
  if (sa.projectId !== expected) {
    logAdminDiagnostics(getAdminCredentialDiagnostics({ adminAppInitialized: false }));
    serverConfigError(
      `Firebase Admin project_id is ${sa.projectId}, expected ${expected}.`,
    );
  }
  try {
    const app = initializeApp({
      credential: cert({
        projectId: sa.projectId,
        clientEmail: sa.clientEmail,
        privateKey: sa.privateKey,
      }),
      projectId: sa.projectId,
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET ||
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
        undefined,
    });
    logAdminDiagnostics(getAdminCredentialDiagnostics({ adminAppInitialized: true }));
    return app;
  } catch (err) {
    logAdminDiagnostics(getAdminCredentialDiagnostics({ adminAppInitialized: false }));
    serverConfigError(
      `Invalid Firebase Admin credentials: ${String((err as Error)?.message || "cert failed").slice(0, 120)}`,
    );
  }
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export async function probeAdminFirestore(): Promise<{
  ok: boolean;
  adminAppInitialized: boolean;
  firestoreConnectionAttempted: true;
  message: string;
}> {
  const db = getAdminDb();
  try {
    await db.collection("settings").limit(1).get();
    console.info("[Firebase Admin] Firestore probe SUCCESS");
    return {
      ok: true,
      adminAppInitialized: true,
      firestoreConnectionAttempted: true,
      message: "SUCCESS",
    };
  } catch (err) {
    const message = String((err as Error)?.message || "Firestore probe failed").slice(0, 180);
    console.info("[Firebase Admin] Firestore probe FAIL", { message });
    return {
      ok: false,
      adminAppInitialized: true,
      firestoreConnectionAttempted: true,
      message,
    };
  }
}

export async function getAdminAuth(): Promise<Auth> {
  getAdminApp();
  const { getAuth } = await import("firebase-admin/auth");
  return getAuth();
}

export async function getAdminMessaging(): Promise<Messaging> {
  getAdminApp();
  const { getMessaging } = await import("firebase-admin/messaging");
  return getMessaging();
}

export function hasServiceAccount(): boolean {
  return Boolean(parseServiceAccount());
}

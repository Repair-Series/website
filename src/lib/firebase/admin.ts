import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import { Messaging, getMessaging } from "firebase-admin/messaging";

function parseServiceAccount(): Record<string, unknown> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || !String(raw).trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    } catch {
      return null;
    }
  }
}

function getAdminApp(): App {
  if (getApps().length) return getApps()[0]!;
  const sa = parseServiceAccount();
  if (!sa) {
    throw Object.assign(
      new Error(
        "Missing FIREBASE_SERVICE_ACCOUNT_JSON (paste service account JSON or base64 on Vercel)",
      ),
      { status: 503 },
    );
  }
  try {
    return initializeApp({
      credential: cert(sa as Parameters<typeof cert>[0]),
      projectId:
        String(sa.project_id || process.env.FIREBASE_PROJECT_ID || "repair-series"),
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET ||
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
        undefined,
    });
  } catch {
    throw Object.assign(new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON"), {
      status: 503,
    });
  }
}

export function getAdminDb(): Firestore {
  getAdminApp();
  return getFirestore();
}

export function getAdminAuth(): Auth {
  getAdminApp();
  return getAuth();
}

export function getAdminMessaging(): Messaging {
  getAdminApp();
  return getMessaging();
}

export function hasServiceAccount(): boolean {
  return Boolean(parseServiceAccount());
}

import { FirebaseApp, getApps, initializeApp } from "firebase/app";

type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

function getFirebaseWebConfig(): FirebaseWebConfig | null {
  /**
   * IMPORTANT (Next.js):
   * On the client, `process.env.FOO` is inlined at build time, but dynamic access
   * like `process.env[name]` is NOT reliably inlined and often becomes undefined.
   * So we must reference NEXT_PUBLIC_* env vars statically.
   */
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

  const missing = [
    !apiKey && "NEXT_PUBLIC_FIREBASE_API_KEY",
    !authDomain && "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    !projectId && "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    !storageBucket && "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    !messagingSenderId && "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    !appId && "NEXT_PUBLIC_FIREBASE_APP_ID",
  ].filter(Boolean);

  if (missing.length > 0) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Repair Series] Firebase env missing:", missing);
    }
    return null;
  }

  return {
    apiKey: apiKey!,
    authDomain: authDomain!,
    projectId: projectId!,
    storageBucket: storageBucket!,
    messagingSenderId: messagingSenderId!,
    appId: appId!,
    measurementId,
  };
}

export function hasFirebaseWebConfig(): boolean {
  return getFirebaseWebConfig() !== null;
}

let cachedApp: FirebaseApp | null = null;

/**
 * Lazy Firebase init.
 * Returns null when NEXT_PUBLIC_FIREBASE_* env vars are missing so pages can
 * render a friendly setup message instead of crashing (including during `next build`).
 */
export function getFirebaseApp() {
  if (cachedApp) return cachedApp;
  const existing = getApps()[0];
  if (existing) {
    cachedApp = existing;
    return cachedApp;
  }

  const cfg = getFirebaseWebConfig();
  if (!cfg) {
    return null;
  }

  cachedApp = initializeApp(cfg);
  return cachedApp;
}


import { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import {
  getDocumentWithUserToken,
  verifyIdTokenWithApiKey,
} from "@/lib/server/userFirestore";

export type CallerRole = "customer" | "technician" | "admin" | "internal";

export type ApiCaller = {
  uid: string;
  role: CallerRole;
};

function bearerToken(req: NextRequest): string {
  const header = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || "";
}

function internalSecrets(): string[] {
  return [
    process.env.NOTIFY_INTERNAL_SECRET,
    process.env.NOTIFY_SECRET,
    process.env.CRON_SECRET,
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean);
}

/** Server-to-server. Never accept NEXT_PUBLIC_* secrets. */
export function tryInternalAuth(req: NextRequest): ApiCaller | null {
  const token = bearerToken(req);
  if (!token) return null;
  if (internalSecrets().includes(token)) {
    return { uid: "internal", role: "internal" };
  }
  return null;
}

export function adminCredentialFailure(err: unknown): boolean {
  const message = String((err as Error)?.message || "");
  const code = String(
    (err as { code?: string }).code ||
      (err as { errorInfo?: { code?: string } }).errorInfo?.code ||
      "",
  );
  return (
    /16\s*UNAUTHENTICATED|OAuth 2 access token|invalid authentication credentials|ERR_REQUIRE_ESM|jwks-rsa|Failed to load external module/i.test(
      message,
    ) ||
    /app-deleted|invalid-credential|SERVER_CONFIGURATION_ERROR/i.test(code)
  );
}

export async function requireApiCaller(req: NextRequest): Promise<ApiCaller> {
  const header = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = bearerToken(req);
  console.info("[API Auth] header present", Boolean(header));
  console.info("[API Auth] bearer format valid", Boolean(token));

  const internal = tryInternalAuth(req);
  if (internal) return internal;

  if (!token) {
    throw Object.assign(new Error("Sign in required"), { status: 401, code: "UNAUTHENTICATED" });
  }

  let uid = "";
  try {
    const decoded = await (await getAdminAuth()).verifyIdToken(token);
    uid = String(decoded.uid || "");
    console.info("[API Auth] decoded uid", uid || "(empty)");
    console.info(
      "[API Auth] firebase project id",
      String(decoded.aud || process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ""),
    );
  } catch (err) {
    const code = String(
      (err as { code?: string }).code ||
        (err as { errorInfo?: { code?: string } }).errorInfo?.code ||
        "",
    );
    console.info("[API Auth] verification error", {
      code: code || "(none)",
      message: String((err as Error)?.message || "").slice(0, 180),
    });
    if (adminCredentialFailure(err)) {
      const fallback = await verifyIdTokenWithApiKey(token);
      uid = fallback.uid;
      console.info("[API Auth] verified via Identity Toolkit fallback", { uid });
    } else {
      throw Object.assign(new Error("Invalid or expired session"), {
        status: 401,
        code: "UNAUTHENTICATED",
      });
    }
  }
  if (!uid) {
    throw Object.assign(new Error("Sign in required"), { status: 401, code: "UNAUTHENTICATED" });
  }

  try {
    const db = getAdminDb();
    const adminSnap = await db.doc(`adminUsers/${uid}`).get();
    if (adminSnap.exists && String(adminSnap.data()?.status ?? "") === "active") {
      return { uid, role: "admin" };
    }
    const techSnap = await db.doc(`technicians/${uid}`).get();
    if (techSnap.exists) {
      return { uid, role: "technician" };
    }
  } catch (err) {
    if (adminCredentialFailure(err)) {
      console.info("[API Auth] Admin Firestore unavailable; resolving role with user token", {
        uid,
        message: String((err as Error)?.message || "").slice(0, 160),
      });
      try {
        const adminDoc = await getDocumentWithUserToken(token, `adminUsers/${uid}`);
        if (adminDoc && String(adminDoc.status ?? "") === "active") {
          return { uid, role: "admin" };
        }
      } catch {
        /* customer cannot read adminUsers */
      }
      try {
        const techDoc = await getDocumentWithUserToken(token, `technicians/${uid}`);
        if (techDoc) return { uid, role: "technician" };
      } catch {
        /* not a technician */
      }
      return { uid, role: "customer" };
    }
    throw err;
  }

  return { uid, role: "customer" };
}

export function assertBookingAccess(
  caller: ApiCaller,
  booking: Record<string, unknown>,
): void {
  if (caller.role === "internal" || caller.role === "admin") return;
  if (caller.role === "customer" && String(booking.customerId ?? "") === caller.uid) {
    return;
  }
  if (
    caller.role === "technician" &&
    String(booking.technicianId ?? "") === caller.uid
  ) {
    return;
  }
  throw Object.assign(new Error("Not allowed"), { status: 403 });
}

export function requireAdminOrInternal(caller: ApiCaller): void {
  if (caller.role === "admin" || caller.role === "internal") return;
  throw Object.assign(new Error("Not allowed"), { status: 403 });
}

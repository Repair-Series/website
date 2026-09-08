import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { normalizeStoredPhone, phoneLookupValues } from "@/lib/auth/phone";

export type IdentityRole = "customer" | "partner";

type FoundDoc = { id: string; data: Record<string, unknown> };

async function findByPhone(
  db: Firestore,
  collectionName: "customers" | "technicians",
  e164: string,
): Promise<FoundDoc | null> {
  const values = phoneLookupValues(e164);
  const seen = new Set<string>();
  const matches: FoundDoc[] = [];

  try {
    const normalizedSnap = await db
      .collection(collectionName)
      .where("phoneNormalized", "==", e164)
      .limit(5)
      .get();
    for (const docSnap of normalizedSnap.docs) {
      if (seen.has(docSnap.id)) continue;
      seen.add(docSnap.id);
      matches.push({ id: docSnap.id, data: docSnap.data() as Record<string, unknown> });
    }
  } catch (err) {
    console.error("phone-identity query phoneNormalized", (err as Error)?.message);
  }

  for (const value of values) {
    try {
      const snap = await db.collection(collectionName).where("phone", "==", value).limit(5).get();
      for (const docSnap of snap.docs) {
        if (seen.has(docSnap.id)) continue;
        seen.add(docSnap.id);
        matches.push({ id: docSnap.id, data: docSnap.data() as Record<string, unknown> });
      }
    } catch (err) {
      console.error("phone-identity query phone", (err as Error)?.message);
    }
  }

  if (!matches.length) return null;
  matches.sort((a, b) => {
    const aBookings = Number(a.data.totalBookings ?? a.data.completedBookings ?? 0);
    const bBookings = Number(b.data.totalBookings ?? b.data.completedBookings ?? 0);
    return bBookings - aBookings;
  });
  return matches[0];
}

async function authUserExists(adminAuth: Auth, uid: string): Promise<boolean> {
  try {
    await adminAuth.getUser(uid);
    return true;
  } catch {
    return false;
  }
}

async function migratePhoneAuthUser(opts: {
  adminAuth: Auth;
  oldUid: string;
  newUid: string;
  e164: string;
}): Promise<string | undefined> {
  const { adminAuth, oldUid, newUid, e164 } = opts;
  if (oldUid === newUid) {
    await adminAuth.updateUser(oldUid, { phoneNumber: e164 }).catch(() => undefined);
    return undefined;
  }

  const oldExists = await authUserExists(adminAuth, oldUid);
  if (!oldExists) {
    return undefined;
  }

  /* Never delete the signed-in phone user here. deleteUser() immediately
     signs the client out and races the custom-token swap. Unlink the phone
     from the new UID, attach it to the existing UID, then return a token. */
  if (newUid !== oldUid && (await authUserExists(adminAuth, newUid))) {
    await adminAuth.updateUser(newUid, { phoneNumber: null }).catch(() => undefined);
  }
  try {
    await adminAuth.updateUser(oldUid, { phoneNumber: e164 });
  } catch (err) {
    const message = String((err as Error)?.message || err);
    if (!/already exists|phone/i.test(message)) {
      throw err;
    }
  }
  return adminAuth.createCustomToken(oldUid);
}

async function uidHasExistingProfile(db: Firestore, uid: string): Promise<boolean> {
  const [customerSnap, partnerSnap] = await Promise.all([
    db.doc(`customers/${uid}`).get(),
    db.doc(`technicians/${uid}`).get(),
  ]);
  return customerSnap.exists || partnerSnap.exists;
}

async function writeCustomerProfile(
  db: Firestore,
  uid: string,
  data: Record<string, unknown>,
) {
  await db.doc(`customers/${uid}`).set(data, { merge: true });
}

function profilePatch(e164: string, extra: Record<string, unknown> = {}) {
  return {
    phone: e164,
    phoneNormalized: e164,
    phoneVerified: true,
    authProvider: "phone",
    updatedAt: FieldValue.serverTimestamp(),
    ...extra,
  };
}

export async function resolvePhoneIdentity(opts: {
  db: Firestore;
  adminAuth: Auth;
  uid: string;
  phoneE164: string;
  role: IdentityRole;
  displayName?: string;
}): Promise<{
  uid: string;
  migrated: boolean;
  created: boolean;
  customToken?: string;
  blocked?: boolean;
  partnerStatus?: string;
  noPartnerRecord?: boolean;
}> {
  const e164 = normalizeStoredPhone(opts.phoneE164);
  if (!e164) {
    throw Object.assign(new Error("Verified phone number is invalid."), { status: 400 });
  }

  if (opts.role === "customer") {
    const existing = await findByPhone(opts.db, "customers", e164);
    if (existing?.data.blocked === true) {
      throw Object.assign(
        new Error("Your account has been temporarily blocked. Please contact support."),
        { status: 403 },
      );
    }

    if (!existing) {
      await writeCustomerProfile(opts.db, opts.uid, {
        uid: opts.uid,
        name: String(opts.displayName || "").trim() || "Customer",
        email: "",
        ...profilePatch(e164),
        address: "",
        addresses: [],
        blocked: false,
        totalBookings: 0,
        lastUsedAddress: null,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { uid: opts.uid, migrated: false, created: true };
    }

    if (existing.id === opts.uid) {
      await writeCustomerProfile(opts.db, opts.uid, profilePatch(e164));
      return { uid: opts.uid, migrated: false, created: false };
    }

    if (await uidHasExistingProfile(opts.db, opts.uid)) {
      throw Object.assign(
        new Error(
          "This mobile number is already linked to another Repair Series account. Contact support to keep your bookings.",
        ),
        { status: 409 },
      );
    }

    const customToken = await migratePhoneAuthUser({
      adminAuth: opts.adminAuth,
      oldUid: existing.id,
      newUid: opts.uid,
      e164,
    });
    if (!customToken) {
      await writeCustomerProfile(opts.db, opts.uid, {
        ...existing.data,
        uid: opts.uid,
        name:
          String(opts.displayName || existing.data.name || "").trim() || "Customer",
        ...profilePatch(e164),
        legacyCustomerId: existing.id,
      });
      return { uid: opts.uid, migrated: false, created: false };
    }
    await writeCustomerProfile(opts.db, existing.id, profilePatch(e164));
    return { uid: existing.id, migrated: true, created: false, customToken };
  }

  const existing = await findByPhone(opts.db, "technicians", e164);
  if (!existing) {
    return { uid: opts.uid, migrated: false, created: false, noPartnerRecord: true };
  }

  if (existing.data.suspended === true) {
    throw Object.assign(
      new Error("This partner account is suspended. Contact support."),
      { status: 403 },
    );
  }

  const partnerStatus = String(
    existing.data.accountStatus ?? existing.data.verificationStatus ?? "",
  );

  if (existing.id === opts.uid) {
    await opts.db.doc(`technicians/${opts.uid}`).set(profilePatch(e164), { merge: true });
    return { uid: opts.uid, migrated: false, created: false, partnerStatus };
  }

  if (await uidHasExistingProfile(opts.db, opts.uid)) {
    throw Object.assign(
      new Error(
        "This mobile number is already linked to another Repair Series account. Contact support to keep your Partner data.",
      ),
      { status: 409 },
    );
  }

  const customToken = await migratePhoneAuthUser({
    adminAuth: opts.adminAuth,
    oldUid: existing.id,
    newUid: opts.uid,
    e164,
  });
  if (!customToken) {
    return { uid: opts.uid, migrated: false, created: false, noPartnerRecord: true, partnerStatus };
  }
  await opts.db.doc(`technicians/${existing.id}`).set(profilePatch(e164), { merge: true });
  return {
    uid: existing.id,
    migrated: true,
    created: false,
    customToken,
    partnerStatus,
  };
}

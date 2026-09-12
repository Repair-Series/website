import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminMessaging, hasServiceAccount } from "@/lib/firebase/admin";
import { channelFor } from "@/lib/notifications/copy";

export type TokenEntry = { token: string; type: "expo" | "fcm" };

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

function isExpoToken(token: string): boolean {
  return token.startsWith("ExponentPushToken");
}

export function collectTokensFromDoc(data: Record<string, unknown> = {}): TokenEntry[] {
  const out: TokenEntry[] = [];
  const push = (raw: unknown, type?: TokenEntry["type"]) => {
    const token = String(raw || "").trim();
    if (!token || token.length < 20) return;
    out.push({
      token,
      type: type || (isExpoToken(token) ? "expo" : "fcm"),
    });
  };

  push(data.expoPushToken, "expo");
  if (Array.isArray(data.fcmTokens)) {
    for (const t of data.fcmTokens) push(t, isExpoToken(String(t)) ? "expo" : "fcm");
  }
  push(data.pushToken, isExpoToken(String(data.pushToken || "")) ? "expo" : "fcm");
  push(data.devicePushToken, data.devicePushType === "expo" ? "expo" : "fcm");

  const seen = new Set<string>();
  return out.filter((x) => {
    if (seen.has(x.token)) return false;
    seen.add(x.token);
    return true;
  });
}

type ExpoTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
};

async function sendExpoPush(
  messages: Array<Record<string, unknown>>,
): Promise<{ sent: number; invalid: string[] }> {
  if (!messages.length) return { sent: 0, invalid: [] };
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: ExpoTicket | ExpoTicket[];
  };
  if (!res.ok) {
    throw new Error(`Expo push failed (${res.status})`);
  }
  const tickets = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];
  const invalid: string[] = [];
  tickets.forEach((ticket, i) => {
    const err = String(ticket?.details?.error || "");
    if (ticket?.status === "error" && (err === "DeviceNotRegistered" || err === "InvalidCredentials")) {
      const to = String(messages[i]?.to || "");
      if (to) invalid.push(to);
    }
  });
  const sent = tickets.filter((t) => t?.status !== "error").length || messages.length - invalid.length;
  return { sent: Math.max(0, sent), invalid };
}

async function sendFcm(
  tokens: string[],
  payload: PushPayload,
): Promise<{ sent: number; invalid: string[] }> {
  if (!tokens.length || !hasServiceAccount()) return { sent: 0, invalid: [] };
  const messaging = await getAdminMessaging();
  const stringData: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload.data || {})) {
    if (v == null) continue;
    stringData[String(k)] = String(v);
  }
  const channelId = channelFor(stringData.type || "");
  const invalid: string[] = [];
  let sent = 0;
  for (const token of tokens) {
    try {
      await messaging.send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: stringData,
        android: {
          priority: "high",
          notification: { channelId, sound: "default" },
        },
        apns: {
          payload: { aps: { sound: "default", badge: 1 } },
        },
      });
      sent += 1;
    } catch (err) {
      const code = String((err as { code?: string })?.code || "");
      if (
        code.includes("registration-token-not-registered") ||
        code.includes("invalid-registration-token")
      ) {
        invalid.push(token);
      }
    }
  }
  return { sent, invalid };
}

export async function deliverToTokens(
  tokenEntries: TokenEntry[],
  payload: PushPayload,
): Promise<{ expo: number; fcm: number; total: number; invalid: string[] }> {
  const expoMsgs: Array<Record<string, unknown>> = [];
  const fcmTokens: string[] = [];
  const type = String(payload.data?.type || "");
  const channelId = channelFor(type);

  for (const entry of tokenEntries) {
    if (entry.type === "expo" || isExpoToken(entry.token)) {
      expoMsgs.push({
        to: entry.token,
        sound: "default",
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        channelId,
        priority: "high",
      });
    } else {
      fcmTokens.push(entry.token);
    }
  }

  const expoResult = await sendExpoPush(expoMsgs);
  const fcmResult = await sendFcm(fcmTokens, payload);
  return {
    expo: expoResult.sent,
    fcm: fcmResult.sent,
    total: expoResult.sent + fcmResult.sent,
    invalid: [...expoResult.invalid, ...fcmResult.invalid],
  };
}

export async function pruneInvalidTokens(
  db: Firestore,
  collectionName: "customers" | "technicians",
  docId: string,
  invalid: string[],
): Promise<void> {
  const unique = [...new Set(invalid.map((t) => String(t || "").trim()).filter(Boolean))];
  if (!docId || !unique.length) return;
  const ref = db.collection(collectionName).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const data = (snap.data() || {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  let changed = false;
  for (const field of ["expoPushToken", "pushToken", "devicePushToken"] as const) {
    const current = String(data[field] || "");
    if (current && unique.includes(current)) {
      patch[field] = FieldValue.delete();
      changed = true;
    }
  }
  if (Array.isArray(data.fcmTokens) && data.fcmTokens.some((t) => unique.includes(String(t)))) {
    patch.fcmTokens = FieldValue.arrayRemove(...unique);
    changed = true;
  }
  if (!changed) return;
  await ref.update(patch);
}

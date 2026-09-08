/**
 * Calls the website Vercel notify API with a Firebase ID token.
 * Do not send NOTIFY_SECRET from the browser.
 */
import { getAuthClient } from "@/lib/firebase/auth";

export async function requestRemotePush(payload: Record<string, unknown>) {
  const auth = getAuthClient();
  const user = auth?.currentUser;
  if (!user) return { skipped: true as const };

  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/notifications/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, ...json };
  } catch (e: unknown) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

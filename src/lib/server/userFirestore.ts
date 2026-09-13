/**
 * Authenticated Firestore reads using the caller's Firebase ID token.
 * Used when Firebase Admin service-account credentials are rejected by Google.
 */

function projectId() {
  return String(
    process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      "repair-series",
  ).trim();
}

function decodeValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const v = value as Record<string, unknown>;
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("mapValue" in v) {
    return decodeFields((v.mapValue as { fields?: Record<string, unknown> }).fields);
  }
  if ("arrayValue" in v) {
    const vals = (v.arrayValue as { values?: unknown[] }).values || [];
    return vals.map(decodeValue);
  }
  return null;
}

function decodeFields(fields?: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (!fields) return out;
  for (const [key, value] of Object.entries(fields)) {
    out[key] = decodeValue(value);
  }
  return out;
}

export async function getDocumentWithUserToken(
  idToken: string,
  docPath: string,
): Promise<Record<string, unknown> | null> {
  const path = String(docPath || "").replace(/^\/+/, "");
  const url = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/${path}`;
  console.info("[UserFirestore] get", { path, projectId: projectId() });
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
    console.info("[UserFirestore] get denied", {
      path,
      status: res.status,
      code: body.error?.status || "",
      message: String(body.error?.message || "").slice(0, 160),
    });
    throw Object.assign(new Error(body.error?.message || "Not allowed"), {
      status: res.status,
    });
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw Object.assign(new Error(body.error?.message || `Firestore read failed (${res.status})`), {
      status: res.status >= 500 ? 502 : res.status,
    });
  }
  const json = (await res.json()) as { name?: string; fields?: Record<string, unknown> };
  const id = String(json.name || "").split("/").pop() || "";
  return { id, ...decodeFields(json.fields) };
}

export async function queryFirstByCodeWithUserToken(
  idToken: string,
  collectionId: string,
  code: string,
): Promise<Record<string, unknown> | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents:runQuery`;
  console.info("[UserFirestore] query", { collectionId, projectId: projectId() });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: "code" },
            op: "EQUAL",
            value: { stringValue: code },
          },
        },
        limit: 1,
      },
    }),
  });
  if (!res.ok) {
    console.info("[UserFirestore] query failed", { collectionId, status: res.status });
    return null;
  }
  const rows = (await res.json()) as Array<{
    document?: { name?: string; fields?: Record<string, unknown> };
  }>;
  const doc = rows.find((row) => row.document)?.document;
  if (!doc) return null;
  const id = String(doc.name || "").split("/").pop() || "";
  return { id, ...decodeFields(doc.fields) };
}

export async function verifyIdTokenWithApiKey(idToken: string): Promise<{ uid: string; projectId: string }> {
  const apiKey = String(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "").trim();
  if (!apiKey) {
    throw Object.assign(new Error("Firebase API key is not configured"), { status: 503 });
  }
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    users?: Array<{ localId?: string }>;
    error?: { message?: string };
  };
  const uid = String(json.users?.[0]?.localId || "").trim();
  if (!uid) {
    throw Object.assign(new Error("Invalid or expired session"), {
      status: 401,
      code: "UNAUTHENTICATED",
    });
  }
  console.info("[API Auth] identity toolkit uid", uid);
  return { uid, projectId: projectId() };
}

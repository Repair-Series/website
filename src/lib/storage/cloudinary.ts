import crypto from "crypto";

function requireCloudName(): string {
  const name = String(
    process.env.CLOUDINARY_CLOUD_NAME ||
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
      "",
  ).trim();
  if (!name) {
    throw Object.assign(new Error("Cloudinary is not configured on the server"), {
      status: 503,
    });
  }
  return name;
}

function signedCredentials(): { apiKey: string; apiSecret: string } | null {
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

function sign(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .filter((key) => params[key] != null && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");
}

export function isCloudinaryConfigured(): boolean {
  try {
    requireCloudName();
    return Boolean(signedCredentials() || process.env.CLOUDINARY_UPLOAD_PRESET);
  } catch {
    return false;
  }
}

export function cloudinaryPublicIdFromUrl(url: string): string | null {
  const trimmed = String(url || "").trim();
  if (!/res\.cloudinary\.com/i.test(trimmed)) return null;
  const match = trimmed.match(
    /\/(?:image|raw|video)\/upload\/(?:(?:[^/]+\/)*?v\d+\/)?(.+?)(?:\.[a-z0-9]+)?(?:\?|$)/i,
  );
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1]).replace(/\.[a-z0-9]+$/i, "");
}

export async function uploadImageToCloudinary(options: {
  body: Buffer;
  contentType: string;
  publicId: string;
  overwrite?: boolean;
  fileName?: string;
}): Promise<{ publicId: string; url: string; bytes: number; contentType: string }> {
  const cloudName = requireCloudName();
  const signed = signedCredentials();
  const publicId = String(options.publicId || "")
    .replace(/^\/+/, "")
    .replace(/\.[a-z0-9]+$/i, "");
  if (!publicId) {
    throw Object.assign(new Error("Missing Cloudinary public_id"), { status: 400 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const ext = options.contentType.includes("png")
    ? "png"
    : options.contentType.includes("webp")
      ? "webp"
      : "jpg";
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(options.body)], { type: options.contentType || "image/webp" }),
    options.fileName || `upload.${ext}`,
  );

  if (signed) {
    const params: Record<string, string> = {
      public_id: publicId,
      timestamp: String(timestamp),
    };
    if (options.overwrite) params.overwrite = "true";
    const signature = sign(params, signed.apiSecret);
    form.append("api_key", signed.apiKey);
    form.append("timestamp", String(timestamp));
    form.append("signature", signature);
    form.append("public_id", publicId);
    if (options.overwrite) form.append("overwrite", "true");
  } else {
    const preset = String(process.env.CLOUDINARY_UPLOAD_PRESET || "").trim();
    if (!preset) {
      throw Object.assign(
        new Error("Set CLOUDINARY_API_KEY+CLOUDINARY_API_SECRET for image uploads"),
        { status: 503 },
      );
    }
    form.append("upload_preset", preset);
    form.append("public_id", publicId);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    secure_url?: string;
    url?: string;
    public_id?: string;
    bytes?: number;
  };
  if (!response.ok) {
    console.error("[cloudinary] upload failed", {
      status: response.status,
      message: String(payload?.error?.message || ""),
      publicId,
    });
    throw Object.assign(
      new Error(payload?.error?.message || `Cloudinary upload failed (${response.status})`),
      { status: 502 },
    );
  }
  const url = String(payload.secure_url || payload.url || "").trim();
  if (!url) throw new Error("Cloudinary upload returned no URL");
  console.info("[cloudinary] upload ok", { publicId: payload.public_id || publicId, bytes: payload.bytes });
  return {
    publicId: String(payload.public_id || publicId),
    url,
    bytes: Number(payload.bytes) || options.body.length,
    contentType: options.contentType,
  };
}

export async function destroyCloudinaryImage(publicId: string): Promise<void> {
  const id = String(publicId || "").replace(/^\/+/, "").trim();
  if (!id) return;
  const cloudName = requireCloudName();
  const signed = signedCredentials();
  if (!signed) {
    throw Object.assign(new Error("Cloudinary signed credentials required to delete"), {
      status: 503,
    });
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: id, timestamp: String(timestamp) };
  const form = new FormData();
  form.append("public_id", id);
  form.append("timestamp", String(timestamp));
  form.append("api_key", signed.apiKey);
  form.append("signature", sign(params, signed.apiSecret));
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    { method: "POST", body: form },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(payload?.error?.message || `Cloudinary delete failed (${response.status})`);
  }
}

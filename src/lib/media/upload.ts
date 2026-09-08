import { compressImageFile } from "./compress-image";

export type UploadKind =
  | "profile-user"
  | "profile-partner"
  | "service"
  | "coming-soon"
  | "banner"
  | "offer"
  | "home-section"
  | "kyc"
  | "booking-start"
  | "booking-complete"
  | "booking-pause-damaged"
  | "booking-pause-resume"
  | "payment-qr"
  | "company"
  | "spare-part";

export type UploadImageOptions = {
  kind: UploadKind;
  token: string;
  serviceName?: string;
  serviceId?: string;
  slot?: string;
  section?: string;
  bannerId?: string;
  offerId?: string;
  sectionId?: string;
  bookingId?: string;
  ownerId?: string;
  side?: string;
  categoryName?: string;
  categoryId?: string;
};

export type UploadedMedia = {
  url: string;
  fileKey: string;
  storageProvider: string;
  contentType: string;
};

function websiteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return String(process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
}

export async function uploadImage(
  file: File | Blob,
  options: UploadImageOptions,
): Promise<UploadedMedia> {
  if (!options.token) throw new Error("Sign in required");
  const prepared = await compressImageFile(file);
  const form = new FormData();
  form.append("file", prepared);
  form.append("kind", options.kind);
  const extras: Array<[string, string | undefined]> = [
    ["serviceName", options.serviceName],
    ["serviceId", options.serviceId],
    ["slot", options.slot],
    ["section", options.section],
    ["bannerId", options.bannerId],
    ["offerId", options.offerId],
    ["sectionId", options.sectionId],
    ["bookingId", options.bookingId],
    ["ownerId", options.ownerId],
    ["side", options.side],
    ["categoryName", options.categoryName],
    ["categoryId", options.categoryId],
  ];
  for (const [key, value] of extras) {
    if (value) form.append(key, value);
  }

  const response = await fetch(`${websiteOrigin()}/api/storage/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${options.token}` },
    body: form,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    url?: string;
    fileKey?: string;
    storageProvider?: string;
    contentType?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || "Image upload failed");
  }
  const url = String(payload.url || "").trim();
  if (!url) throw new Error("Upload succeeded but no image URL was returned");
  return {
    url,
    fileKey: String(payload.fileKey || ""),
    storageProvider: String(payload.storageProvider || "cloudinary"),
    contentType: String(payload.contentType || prepared.type || "image/webp"),
  };
}

/** Backward-compatible name used by the profile page. */
export async function uploadImageToCloudinary(
  file: File | Blob,
  options: Omit<UploadImageOptions, "kind"> & { kind?: UploadKind },
): Promise<string> {
  const uploaded = await uploadImage(file, {
    ...options,
    kind: options.kind || "profile-user",
  });
  return uploaded.url;
}

import { compressImageFile } from "./compress-image";
import {
  isDirectCloudinaryConfigured,
  uploadFileToCloudinary,
} from "./cloudinary-direct";

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
  token?: string;
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
  publicId: string;
  resourceType: string;
  storageProvider: string;
  contentType: string;
};

export async function uploadImage(
  file: File | Blob,
  options: UploadImageOptions,
): Promise<UploadedMedia> {
  if (!isDirectCloudinaryConfigured()) {
    throw new Error(
      "Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.",
    );
  }
  const prepared = await compressImageFile(file);
  const fileName =
    prepared instanceof File ? prepared.name : `${options.kind || "image"}.webp`;
  const uploaded = await uploadFileToCloudinary(prepared, fileName);
  return {
    url: uploaded.url,
    fileKey: uploaded.publicId,
    publicId: uploaded.publicId,
    resourceType: uploaded.resourceType,
    storageProvider: "cloudinary",
    contentType: prepared.type || "image/webp",
  };
}

/** Backward-compatible name used by the profile page. */
export async function uploadImageToCloudinary(
  file: File | Blob,
  options: Omit<UploadImageOptions, "kind"> & { kind?: UploadKind } = {},
): Promise<string> {
  const uploaded = await uploadImage(file, {
    ...options,
    kind: options.kind || "profile-user",
  });
  return uploaded.url;
}

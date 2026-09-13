export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
  resourceType: string;
};

function cloudinaryConfig() {
  const cloudName = String(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "").trim();
  const uploadPreset = String(
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "",
  ).trim();
  return { cloudName, uploadPreset };
}

export function isDirectCloudinaryConfigured() {
  const { cloudName, uploadPreset } = cloudinaryConfig();
  return Boolean(cloudName && uploadPreset);
}

export async function uploadFileToCloudinary(
  file: Blob | File,
  fileName = "upload.jpg",
): Promise<CloudinaryUploadResult> {
  const { cloudName, uploadPreset } = cloudinaryConfig();
  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET for direct image upload.",
    );
  }

  const form = new FormData();
  form.append("file", file, fileName);
  form.append("upload_preset", uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    secure_url?: string;
    public_id?: string;
    resource_type?: string;
    error?: { message?: string } | string;
  };
  if (!response.ok) {
    const message =
      (typeof payload.error === "object" && payload.error?.message) ||
      (typeof payload.error === "string" ? payload.error : "") ||
      `Cloudinary upload failed (${response.status}).`;
    throw new Error(message);
  }
  const url = String(payload.secure_url || "").trim();
  if (!url) throw new Error("Cloudinary did not return a secure URL.");
  return {
    url,
    publicId: String(payload.public_id || ""),
    resourceType: String(payload.resource_type || "image"),
  };
}

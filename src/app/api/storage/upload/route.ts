import { NextRequest } from "next/server";
import { requireApiCaller } from "@/lib/server/auth";
import { apiOptions, jsonWithCors, publicErrorMessage } from "@/lib/server/http";
import {
  IMAGE_STORAGE_PROVIDER,
  authorizeUpload,
  buildPublicImageKey,
  metaFromForm,
  optimizeImageBuffer,
  shouldOverwriteCloudinary,
  uploadImageToCloudinary,
  validateImageBuffer,
  MAX_OPTIMIZED_IMAGE_BYTES,
} from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

export function OPTIONS(req: NextRequest) {
  return apiOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    const caller = await requireApiCaller(req);
    const form = await req.formData();
    const meta = metaFromForm(form, caller);
    await authorizeUpload(caller, meta);

    const file = form.get("file");
    if (!(file instanceof Blob) || file.size < 1) {
      return jsonWithCors(req, { error: "Missing image file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { contentType: sniffedType } = validateImageBuffer(buffer, file.type);
    const optimized = await optimizeImageBuffer(buffer, sniffedType);
    if (optimized.buffer.length > MAX_OPTIMIZED_IMAGE_BYTES) {
      return jsonWithCors(
        req,
        { error: "Image is still too large after compression" },
        { status: 400 },
      );
    }
    const contentType = optimized.contentType;

    const ownerId =
      meta.kind === "profile-user" ||
      meta.kind === "profile-partner" ||
      meta.kind === "kyc"
        ? caller.role === "admin"
          ? meta.ownerId || caller.uid
          : caller.uid
        : meta.ownerId;

    const publicId = buildPublicImageKey({
      ...meta,
      ownerId,
      contentType,
    });

    const uploaded = await uploadImageToCloudinary({
      body: optimized.buffer,
      contentType,
      publicId,
      overwrite: shouldOverwriteCloudinary(meta.kind),
    });

    return jsonWithCors(req, {
      ok: true,
      storageProvider: IMAGE_STORAGE_PROVIDER,
      fileKey: uploaded.publicId,
      publicId: uploaded.publicId,
      url: uploaded.url,
      contentType,
      bytes: uploaded.bytes,
      uploadedAt: new Date().toISOString(),
    });
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = publicErrorMessage(err, "Image upload failed");
    console.error("api/storage/upload", String((err as Error)?.message || err));
    return jsonWithCors(req, { error: message }, { status });
  }
}

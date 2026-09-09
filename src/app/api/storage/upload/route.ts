import { NextRequest } from "next/server";
import { requireApiCaller } from "@/lib/server/auth";
import { apiOptions, jsonWithCors, publicErrorMessage } from "@/lib/server/http";
import { isCloudinaryConfigured } from "@/lib/storage/cloudinary";
import { uploadImageToCloudinary } from "@/lib/storage/cloudinary";
import { IMAGE_STORAGE_PROVIDER, buildPublicImageKey, shouldOverwriteCloudinary } from "@/lib/storage/keys";
import { authorizeUpload, metaFromForm } from "@/lib/storage/kinds";
import { optimizeImageBuffer } from "@/lib/storage/optimize-image";
import { MAX_OPTIMIZED_IMAGE_BYTES, validateImageBuffer } from "@/lib/storage/validate";

export const runtime = "nodejs";
export const maxDuration = 30;

type FileLike = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  size: number;
  type?: string;
  name?: string;
};

function isFileLike(value: unknown): value is FileLike {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as FileLike).arrayBuffer === "function" &&
      Number((value as FileLike).size) > 0,
  );
}

function cloudinaryConfigPresence() {
  return {
    cloudName: Boolean(
      String(process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "").trim(),
    ),
    apiKey: Boolean(String(process.env.CLOUDINARY_API_KEY || "").trim()),
    apiSecret: Boolean(String(process.env.CLOUDINARY_API_SECRET || "").trim()),
    uploadPreset: Boolean(String(process.env.CLOUDINARY_UPLOAD_PRESET || "").trim()),
  };
}

export function OPTIONS(req: NextRequest) {
  return apiOptions(req);
}

export function GET(req: NextRequest) {
  return jsonWithCors(
    req,
    { error: "Use POST with multipart file + kind" },
    { status: 405 },
  );
}

export async function POST(req: NextRequest) {
  let kind = "";
  try {
    console.info("[storage/upload] request", {
      cloudinary: cloudinaryConfigPresence(),
    });
    if (!isCloudinaryConfigured()) {
      throw Object.assign(new Error("Cloudinary is not configured on the server"), {
        status: 503,
      });
    }

    const caller = await requireApiCaller(req);
    const form = (await req.formData()) as unknown as {
      get(name: string): File | Blob | string | null;
    };
    const meta = metaFromForm(form, caller);
    kind = meta.kind;
    await authorizeUpload(caller, meta);

    const file = form.get("file");
    if (!isFileLike(file)) {
      return jsonWithCors(req, { error: "Missing image file" }, { status: 400 });
    }

    console.info("[storage/upload] file", {
      kind: meta.kind,
      role: caller.role,
      bytes: file.size,
      claimedType: String(file.type || ""),
      name: String(file.name || ""),
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const { contentType: sniffedType } = validateImageBuffer(buffer, file.type);
    const optimized = await optimizeImageBuffer(buffer, sniffedType);
    if (optimized.buffer.length > MAX_OPTIMIZED_IMAGE_BYTES) {
      return jsonWithCors(
        req,
        { error: "Image is still too large after compression" },
        { status: 413 },
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

    console.info("[storage/upload] ok", {
      kind: meta.kind,
      publicId: uploaded.publicId,
      bytes: uploaded.bytes,
    });

    return jsonWithCors(req, {
      ok: true,
      success: true,
      storageProvider: IMAGE_STORAGE_PROVIDER,
      fileKey: uploaded.publicId,
      publicId: uploaded.publicId,
      url: uploaded.url,
      resourceType: "image",
      contentType,
      bytes: uploaded.bytes,
      uploadedAt: new Date().toISOString(),
    });
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = publicErrorMessage(err, "Image upload failed");
    console.error("[storage/upload] fail", {
      kind,
      status,
      message: String((err as Error)?.message || err),
      cloudinary: cloudinaryConfigPresence(),
    });
    return jsonWithCors(req, { error: message }, { status });
  }
}

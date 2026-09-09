import { NextRequest, NextResponse } from "next/server";
import { requireApiCaller } from "@/lib/server/auth";
import { publicErrorMessage } from "@/lib/server/http";
import { isCloudinaryConfigured, uploadImageToCloudinary } from "@/lib/storage/cloudinary";
import { IMAGE_STORAGE_PROVIDER, buildPublicImageKey, shouldOverwriteCloudinary } from "@/lib/storage/keys";
import { authorizeUpload, metaFromForm } from "@/lib/storage/kinds";
import { optimizeImageBuffer } from "@/lib/storage/optimize-image";
import { MAX_OPTIMIZED_IMAGE_BYTES, validateImageBuffer } from "@/lib/storage/validate";

type FileLike = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  size: number;
  type?: string;
  name?: string;
};

function isFileLike(value: unknown): value is FileLike {
  if (!value || typeof value === "string") return false;
  if (typeof value !== "object") return false;
  const file = value as FileLike;
  return typeof file.arrayBuffer === "function";
}

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const requested = String(req.headers.get("access-control-request-headers") || "").trim();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": requested
      ? `Authorization, Content-Type, Accept, Origin, X-Requested-With, ${requested}`
      : "Authorization, Content-Type, Accept, Origin, X-Requested-With",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(req: NextRequest, body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: corsHeaders(req) });
}

function envStatus() {
  return {
    cloudName: Boolean(String(process.env.CLOUDINARY_CLOUD_NAME || "").trim()),
    apiKey: Boolean(String(process.env.CLOUDINARY_API_KEY || "").trim()),
    apiSecret: Boolean(String(process.env.CLOUDINARY_API_SECRET || "").trim()),
    firebaseAdmin: Boolean(String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim()),
  };
}

export async function handleUploadPost(req: NextRequest) {
  let kind = "";
  try {
    console.info("[Storage Upload] Cloudinary configuration status", envStatus());
    console.info("[Storage Upload] Method:", req.method);
    console.info("[Storage Upload] Content-Type:", req.headers.get("content-type") || "(none)");

    if (!isCloudinaryConfigured()) {
      throw Object.assign(new Error("Cloudinary is not configured on the server"), {
        status: 503,
      });
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      console.error("[Storage Upload] Upload failed", "Invalid multipart request");
      return json(req, { error: "Invalid multipart request" }, 400);
    }

    const kindRaw = String(form.get("kind") || "").trim();
    const fileField = form.get("file");
    const fileOk = isFileLike(fileField);
    console.info("[Storage Upload] File received:", fileOk);
    console.info("[Storage Upload] Kind received:", kindRaw || "(empty)");

    const caller = await requireApiCaller(req);
    console.info("[Storage Upload] Authentication result", { role: caller.role });

    if (!kindRaw) {
      return json(req, { error: "Missing kind" }, 400);
    }
    const meta = metaFromForm(form, caller);
    kind = meta.kind;
    console.info("[Storage Upload] Upload purpose", { kind: meta.kind });
    await authorizeUpload(caller, meta);

    if (typeof fileField === "string") {
      return json(req, { error: "Missing file" }, 400);
    }
    if (!fileOk) {
      return json(req, { error: "Missing file" }, 400);
    }
    const file = fileField;

    console.info("[Storage Upload] File received", {
      bytes: file.size,
      claimedType: String(file.type || ""),
      name: String(file.name || ""),
    });
    console.info("[Storage Upload] Validation successful");

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer.length) {
      return json(req, { error: "Missing file" }, 400);
    }
    const { contentType: sniffedType } = validateImageBuffer(buffer, file.type);
    const optimized = await optimizeImageBuffer(buffer, sniffedType);
    if (optimized.buffer.length > MAX_OPTIMIZED_IMAGE_BYTES) {
      return json(req, { error: "Image is still too large after compression" }, 413);
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

    console.info("[Storage Upload] Upload started", { publicId });
    const uploaded = await uploadImageToCloudinary({
      body: optimized.buffer,
      contentType,
      publicId,
      overwrite: shouldOverwriteCloudinary(meta.kind),
    });
    console.info("[Storage Upload] Upload successful", {
      publicId: uploaded.publicId,
      bytes: uploaded.bytes,
    });

    return json(
      req,
      {
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
      },
      200,
    );
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = publicErrorMessage(err, "Image upload failed");
    console.error("[Storage Upload] Upload failed", {
      kind,
      status,
      message: String((err as Error)?.message || err),
      stack: (err as Error)?.stack,
      env: envStatus(),
    });
    return json(req, { error: message }, status);
  }
}

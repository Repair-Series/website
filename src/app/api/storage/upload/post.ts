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
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as FileLike).arrayBuffer === "function" &&
      Number((value as FileLike).size) > 0,
  );
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

    if (!isCloudinaryConfigured()) {
      throw Object.assign(new Error("Cloudinary is not configured on the server"), {
        status: 503,
      });
    }

    const caller = await requireApiCaller(req);
    console.info("[Storage Upload] Authentication result", { role: caller.role });

    const form = (await req.formData()) as unknown as {
      get(name: string): File | Blob | string | null;
    };
    const meta = metaFromForm(form, caller);
    kind = meta.kind;
    console.info("[Storage Upload] Upload purpose", { kind: meta.kind });
    await authorizeUpload(caller, meta);

    const file = form.get("file");
    if (!isFileLike(file)) {
      return json(req, { error: "Missing image file" }, 400);
    }

    console.info("[Storage Upload] File received", {
      bytes: file.size,
      claimedType: String(file.type || ""),
      name: String(file.name || ""),
    });

    const buffer = Buffer.from(await file.arrayBuffer());
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

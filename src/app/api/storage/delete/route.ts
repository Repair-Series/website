import { NextRequest } from "next/server";
import { requireAdminOrInternal, requireApiCaller } from "@/lib/server/auth";
import { apiOptions, jsonWithCors, publicErrorMessage } from "@/lib/server/http";
import { cloudinaryPublicIdFromUrl, destroyCloudinaryImage } from "@/lib/storage/cloudinary";
import { isInvoiceKey } from "@/lib/storage/keys";

export const runtime = "nodejs";
export const maxDuration = 30;

export function OPTIONS(req: NextRequest) {
  return apiOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    const caller = await requireApiCaller(req);
    requireAdminOrInternal(caller);

    const body = (await req.json().catch(() => ({}))) as {
      fileKey?: string;
      publicId?: string;
      url?: string;
    };
    const publicId =
      String(body.publicId || body.fileKey || "").replace(/^\/+/, "") ||
      cloudinaryPublicIdFromUrl(String(body.url || "")) ||
      "";
    if (!publicId) {
      return jsonWithCors(req, { error: "Missing publicId" }, { status: 400 });
    }
    if (isInvoiceKey(publicId)) {
      return jsonWithCors(
        req,
        { error: "Invoice files cannot be deleted from this endpoint" },
        { status: 403 },
      );
    }

    await destroyCloudinaryImage(publicId);
    return jsonWithCors(req, { ok: true, publicId });
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = publicErrorMessage(err, "Could not delete file");
    console.error("api/storage/delete", String((err as Error)?.message || err));
    return jsonWithCors(req, { error: message }, { status });
  }
}

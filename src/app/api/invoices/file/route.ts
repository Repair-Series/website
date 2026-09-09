import { NextRequest } from "next/server";
import { apiOptions, jsonWithCors } from "@/lib/api/cors";
import { publicErrorMessage } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 30;

export function OPTIONS(req: NextRequest) {
  return apiOptions(req);
}

export async function GET(req: NextRequest) {
  try {
    const { handleInvoiceFileGet } = await import("./handler");
    return await handleInvoiceFileGet(req);
  } catch (err) {
    const status = Number((err as { status?: number })?.status) || 500;
    const message = publicErrorMessage(err, "Not allowed");
    return jsonWithCors(req, { error: message }, { status });
  }
}

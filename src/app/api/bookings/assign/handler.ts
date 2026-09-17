import { NextRequest } from "next/server";
import { jsonWithCors } from "@/lib/api/cors";
import { adminCredentialFailure, requireApiCaller } from "@/lib/server/auth";
import { publicErrorMessage } from "@/lib/server/http";
import { assignPartner, type AssignMode } from "@/lib/server/assignment/assignPartner";

export async function handleAssignPost(req: NextRequest) {
  try {
    const caller = await requireApiCaller(req);
    const body = (await req.json().catch(() => ({}))) as {
      bookingId?: string;
      mode?: AssignMode;
      technicianId?: string;
      dateStr?: string;
      slotIndex?: number;
      slotLabel?: string;
      reservedSlotIndices?: number[];
      categoryId?: string;
      userLat?: number;
      userLng?: number;
    };
    const result = await assignPartner({
      bookingId: String(body.bookingId || ""),
      mode: body.mode || (body.technicianId ? "specific" : "nearest"),
      caller,
      technicianId: body.technicianId,
      dateStr: body.dateStr,
      slotIndex: body.slotIndex,
      slotLabel: body.slotLabel,
      reservedSlotIndices: body.reservedSlotIndices,
      categoryId: body.categoryId,
      userLat: body.userLat,
      userLng: body.userLng,
    });
    return jsonWithCors(req, result);
  } catch (err) {
    const serverCreds = adminCredentialFailure(err);
    const status = serverCreds
      ? 503
      : Number((err as { status?: number })?.status) || 500;
    return jsonWithCors(
      req,
      {
        success: false,
        error: serverCreds
          ? "Server Firebase Admin credentials were rejected by Google. The booking was not assigned. This is a server configuration error, not a missing partner."
          : publicErrorMessage(err, "Could not assign a partner"),
        code: serverCreds ? "SERVER_CONFIGURATION_ERROR" : (err as { code?: string }).code,
      },
      { status },
    );
  }
}

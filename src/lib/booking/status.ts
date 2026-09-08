import type { BookingDoc } from "@/lib/booking/types";

export const DASHBOARD_TABS = [
  {
    key: "upcoming",
    label: "Upcoming",
    statuses: ["new", "pending", "upcoming"],
  },
  {
    key: "accepted",
    label: "Accepted",
    statuses: ["accepted"],
  },
  {
    key: "assigned",
    label: "Technician Assigned",
    statuses: ["assigned"],
  },
  {
    key: "in_progress",
    label: "In Progress",
    statuses: ["inprogress", "started", "processing"],
  },
  {
    key: "completed",
    label: "Completed",
    statuses: ["completed"],
  },
  {
    key: "cancelled",
    label: "Cancelled",
    statuses: ["cancelled", "canceled"],
  },
] as const;

export type DashboardTabKey = (typeof DASHBOARD_TABS)[number]["key"];

export function normalizeStatus(status: unknown): string {
  return String(status ?? "pending")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function getStatusLabel(status: unknown): string {
  const s = normalizeStatus(status);
  if (s === "new" || s === "pending" || s === "upcoming") return "Upcoming";
  if (s === "assigned") return "Technician Assigned";
  if (s === "inprogress" || s === "started") return "In Progress";
  if (s === "completed") return "Completed";
  if (s === "cancelled" || s === "canceled") return "Cancelled";
  return String(status ?? "Pending");
}

export function getStatusColor(status: unknown): string {
  const s = normalizeStatus(status);
  if (s === "completed") return "bg-green-100 text-green-800";
  if (s === "cancelled" || s === "canceled") return "bg-red-100 text-red-800";
  if (s === "inprogress" || s === "started") return "bg-blue-100 text-blue-800";
  if (s === "assigned") return "bg-purple-100 text-purple-800";
  return "bg-orange-100 text-orange-800";
}

export type TimelineStep = {
  key: string;
  label: string;
  done: boolean;
  active: boolean;
  at?: Date | null;
};

export function getBookingTimeline(booking: BookingDoc): TimelineStep[] {
  const status = normalizeStatus(booking.status);
  const created = booking.createdAt?.toDate?.() ?? null;
  const assigned =
    booking.assignedAt?.toDate?.() ??
    (booking.technicianId ? created : null);
  const onTheWay = booking.arrivalVerifiedAt?.toDate?.() ?? null;
  const started = booking.serviceStartedAt?.toDate?.() ?? null;
  const completed = booking.completedAt?.toDate?.() ?? null;

  const steps: TimelineStep[] = [
    { key: "booked", label: "Booked", done: !!created, active: status === "new" || status === "pending", at: created },
    { key: "accepted", label: "Accepted", done: status !== "cancelled" && status !== "canceled" && !!created, active: status === "pending", at: created },
    { key: "assigned", label: "Technician Assigned", done: !!booking.technicianId, active: status === "assigned", at: assigned },
    { key: "on_way", label: "On The Way", done: !!booking.arrivalVerified, active: status === "assigned" && !booking.arrivalVerified, at: onTheWay },
    { key: "in_progress", label: "In Progress", done: status === "inprogress" || status === "completed", active: status === "inprogress" || status === "started", at: started },
    { key: "completed", label: "Completed", done: status === "completed", active: status === "completed", at: completed },
  ];

  if (status === "cancelled" || status === "canceled") {
    return steps.map((s) => ({ ...s, active: false }));
  }
  return steps;
}

import { MyBookings } from "@/app/dashboard/bookings/my-bookings";

export const metadata = {
  title: "My Bookings",
  description: "Track your Repair Series bookings in real time.",
};

export default function BookingsDashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-[#0a0f1c]">My Bookings</h1>
      <p className="mt-2 text-sm text-[#64748b]">
        Real-time updates — same status as the mobile app.
      </p>
      <MyBookings />
    </div>
  );
}


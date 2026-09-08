import { BookingDetail } from "@/app/dashboard/bookings/[bookingId]/booking-detail";

export const metadata = {
  title: "Booking details",
  description: "Track your Repair Series booking in real time.",
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return <BookingDetail bookingId={bookingId} />;
}


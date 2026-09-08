import { Suspense } from "react";
import { Container } from "@/components/container";
import { BookingFlow } from "@/app/book/[serviceId]/booking-flow";

export default async function BookServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  return (
    <Container className="py-12">
      <Suspense
        fallback={
          <div className="mx-auto h-96 max-w-3xl animate-pulse rounded-[24px] bg-muted/50" />
        }
      >
        <BookingFlow serviceIdOrSlug={serviceId} />
      </Suspense>
    </Container>
  );
}


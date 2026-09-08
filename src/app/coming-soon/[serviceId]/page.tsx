import { ComingSoonDetail } from "./coming-soon-detail";

export default async function ComingSoonPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  return <ComingSoonDetail serviceIdOrSlug={serviceId} />;
}


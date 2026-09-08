import { Container } from "@/components/container";
import { CategoryDetail } from "@/app/categories/[categoryId]/category-detail";

/** Singular alias: /category/plumber → same as /categories/plumber */
export default async function CategoryAliasPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  return (
    <Container className="py-12">
      <CategoryDetail categoryIdOrSlug={categoryId} />
    </Container>
  );
}


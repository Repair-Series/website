import { Container } from "@/components/container";
import { CategoriesGrid } from "@/app/categories/categories-grid";
import { PromoBannerSection } from "@/components/home/promo-banner";

export const metadata = {
  title: "Categories",
  description: "Browse service categories and start your booking.",
};

export default function CategoriesPage() {
  return (
    <Container className="py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Categories</h1>
        <p className="text-muted-foreground">
          Live categories are loaded from your existing Firestore `categories`
          collection (no duplicate DB).
        </p>
      </div>
      <div className="mt-6">
        <PromoBannerSection section="categories" />
      </div>
      <CategoriesGrid />
    </Container>
  );
}


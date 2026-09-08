import type { Metadata } from "next";
import { buildDefaultDescription } from "@/lib/seo/site";
import SearchResultsClient from "./search-results";

export const metadata: Metadata = {
  title: "Search Services",
  description: buildDefaultDescription(),
  alternates: { canonical: "https://www.repairseries.in/search" },
};

export default function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return <SearchResultsClient searchParams={searchParams} />;
}


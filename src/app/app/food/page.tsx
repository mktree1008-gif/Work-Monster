import { FoodPageClient } from "@/components/wellness/food-page-client";
import { getViewerContext } from "@/lib/view-model";

export default async function FoodPage() {
  await getViewerContext();
  return <FoodPageClient />;
}

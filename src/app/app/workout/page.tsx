import { WorkoutPageClient } from "@/components/wellness/workout-page-client";
import { getViewerContext } from "@/lib/view-model";

export default async function WorkoutPage() {
  const { strings } = await getViewerContext();
  return <WorkoutPageClient labels={strings} />;
}

import { WorkoutPageClient } from "@/components/wellness/workout-page-client";
import { getViewerContext } from "@/lib/view-model";

export default async function WorkoutPage() {
  const { bundle, strings } = await getViewerContext();
  return <WorkoutPageClient labels={strings} userId={bundle.user.id} />;
}

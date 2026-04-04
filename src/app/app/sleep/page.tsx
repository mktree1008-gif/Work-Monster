import { SleepPageClient } from "@/components/wellness/sleep-page-client";
import { getViewerContext } from "@/lib/view-model";

export default async function SleepPage() {
  const { bundle, strings } = await getViewerContext();
  return <SleepPageClient labels={strings} userId={bundle.user.id} />;
}

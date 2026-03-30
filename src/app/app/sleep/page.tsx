import { SleepPageClient } from "@/components/wellness/sleep-page-client";
import { getViewerContext } from "@/lib/view-model";

export default async function SleepPage() {
  const { strings } = await getViewerContext();
  return <SleepPageClient labels={strings} />;
}

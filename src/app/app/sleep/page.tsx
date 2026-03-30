import { SleepPageClient } from "@/components/wellness/sleep-page-client";
import { getViewerContext } from "@/lib/view-model";

export default async function SleepPage() {
  await getViewerContext();
  return <SleepPageClient />;
}

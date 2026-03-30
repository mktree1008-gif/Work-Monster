import { ProductivityRecordSystem } from "@/components/record/productivity-record-system";
import { UserPageShell } from "@/components/user-page-shell";
import { getViewerContext } from "@/lib/view-model";

export default async function RecordInsightsPage() {
  const { bundle, strings } = await getViewerContext();

  return (
    <UserPageShell activeTab="record" labels={strings} subtitle="Behavior patterns and actions" title="Smart Insights">
      <ProductivityRecordSystem
        locale={bundle.user.locale}
        mode="insights"
        notifications={bundle.notifications}
        score={bundle.score}
        submissions={bundle.submissions}
        userId={bundle.user.id}
      />
    </UserPageShell>
  );
}

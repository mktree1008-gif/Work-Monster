import { ProductivityRecordSystem } from "@/components/record/productivity-record-system";
import { UserPageShell } from "@/components/user-page-shell";
import { getViewerContext } from "@/lib/view-model";

export default async function RecordPerformancePage() {
  const { bundle, strings } = await getViewerContext();

  return (
    <UserPageShell activeTab="record" labels={strings} subtitle="Unified productivity analytics" title="Performance Analytics">
      <ProductivityRecordSystem
        locale={bundle.user.locale}
        mode="performance"
        notifications={bundle.notifications}
        score={bundle.score}
        submissions={bundle.submissions}
        userId={bundle.user.id}
      />
    </UserPageShell>
  );
}

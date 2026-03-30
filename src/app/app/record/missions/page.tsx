import { ProductivityRecordSystem } from "@/components/record/productivity-record-system";
import { UserPageShell } from "@/components/user-page-shell";
import { getViewerContext } from "@/lib/view-model";

export default async function RecordMissionAnalyticsPage() {
  const { bundle, strings } = await getViewerContext();

  return (
    <UserPageShell activeTab="record" labels={strings} subtitle="Mission completion and velocity" title="Mission Analytics">
      <ProductivityRecordSystem
        locale={bundle.user.locale}
        mode="missions"
        notifications={bundle.notifications}
        score={bundle.score}
        submissions={bundle.submissions}
        userId={bundle.user.id}
      />
    </UserPageShell>
  );
}

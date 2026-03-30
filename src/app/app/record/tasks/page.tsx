import { ProductivityRecordSystem } from "@/components/record/productivity-record-system";
import { UserPageShell } from "@/components/user-page-shell";
import { getViewerContext } from "@/lib/view-model";

export default async function RecordTaskBreakdownPage() {
  const { bundle, strings } = await getViewerContext();

  return (
    <UserPageShell activeTab="record" labels={strings} subtitle="Category and impact structure" title="Task Breakdown">
      <ProductivityRecordSystem
        locale={bundle.user.locale}
        mode="tasks"
        notifications={bundle.notifications}
        score={bundle.score}
        submissions={bundle.submissions}
        userId={bundle.user.id}
      />
    </UserPageShell>
  );
}

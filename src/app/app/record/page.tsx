import { RecordHubTabs } from "@/components/record/record-hub-tabs";
import { UserPageShell } from "@/components/user-page-shell";
import { getViewerContext } from "@/lib/view-model";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RecordPage({ searchParams }: Props) {
  const { bundle, strings } = await getViewerContext();
  const params = (searchParams ? await searchParams : {}) as Record<string, string | string[] | undefined>;
  const focusSubmissionId = typeof params.focus === "string" ? params.focus : "";
  const initialSection = typeof params.section === "string" ? params.section : undefined;

  return (
    <UserPageShell activeTab="record" labels={strings} subtitle="Your momentum map" title="Record">
      <RecordHubTabs
        focusSubmissionId={focusSubmissionId}
        initialWellnessSection={initialSection}
        locale={bundle.user.locale}
        notifications={bundle.notifications}
        penaltyHistory={bundle.penaltyHistory}
        rewardClaims={bundle.rewardClaims}
        score={bundle.score}
        submissions={bundle.submissions}
        userId={bundle.user.id}
      />
    </UserPageShell>
  );
}

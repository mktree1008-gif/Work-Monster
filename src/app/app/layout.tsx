import { APP_NAME } from "@/lib/constants";
import { getViewerContext } from "@/lib/view-model";
import { RulesOnboardingModal } from "@/components/rules-onboarding-modal";
import { TopAppBar } from "@/components/top-app-bar";

export default async function UserLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { bundle, strings } = await getViewerContext();
  const showOnboarding = bundle.user.last_seen_rule_version < bundle.rules.rule_version;

  return (
    <>
      <TopAppBar
        appName={APP_NAME}
        displayName={(bundle.user.name ?? "").trim() || bundle.user.login_id}
        labels={{
          questions: strings.questions,
          record: strings.record,
          rewards: strings.rewards,
          score: strings.score,
          rules: strings.rules,
          account: strings.account
        }}
        locale={bundle.user.locale}
        profileAvatarEmoji={bundle.user.profile_avatar_emoji}
        profileAvatarUrl={bundle.user.profile_avatar_url}
        role={bundle.user.role}
      />
      <main className="container-mobile page-padding">{children}</main>
      <RulesOnboardingModal
        changelog={bundle.rules.changelog}
        lastSeenVersion={bundle.user.last_seen_rule_version}
        lastUpdated={bundle.rules.last_updated}
        locale={bundle.user.locale}
        openOnLoad={showOnboarding}
        ruleVersion={bundle.rules.rule_version}
      />
    </>
  );
}

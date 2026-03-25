import { APP_NAME } from "@/lib/constants";
import { getViewerContext } from "@/lib/view-model";
import { RulesOnboardingModal } from "@/components/rules-onboarding-modal";
import { TopAppBar } from "@/components/top-app-bar";
import { UserManagerUpdatesModal } from "@/components/user-manager-updates-modal";
import { acknowledgeManagerUpdatesAction, acknowledgeNotificationsAction } from "@/lib/services/actions";

export default async function UserLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { bundle, strings } = await getViewerContext();
  const managerPreview = bundle.user.role === "manager";
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
        notifications={bundle.notifications}
        unreadNotificationCount={bundle.unread_notification_count}
        notificationAction={acknowledgeNotificationsAction}
      />
      <main className="container-mobile page-padding">{children}</main>
      {managerPreview && (
        <div className="fixed inset-x-0 bottom-[5.7rem] z-30 mx-auto w-[min(100%,_24rem)] px-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 shadow-sm">
            Manager preview mode: user actions are read-only here.
          </div>
        </div>
      )}
      <UserManagerUpdatesModal
        action={acknowledgeManagerUpdatesAction}
        locale={bundle.user.locale}
        updates={showOnboarding ? [] : bundle.managerUpdates}
      />
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

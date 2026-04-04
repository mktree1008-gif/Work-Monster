"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CircleUserRound, Dumbbell, Gift, House, Menu, Moon, Settings2, Shield, Star, Utensils, X } from "lucide-react";
import { AppNotification, Locale, UserRole } from "@/lib/types";
import { logoutAction, setLocaleAction } from "@/lib/services/actions";
import { ProfileAvatar } from "@/components/profile-avatar";
import { NotificationBell } from "@/components/notification-bell";

type Props = {
  appName: string;
  role: UserRole;
  locale: Locale;
  labels: {
    questions: string;
    record: string;
    rewards: string;
    score: string;
    rules: string;
    account: string;
  };
  displayName?: string;
  profileAvatarEmoji?: string;
  profileAvatarUrl?: string;
  notifications: AppNotification[];
  unreadNotificationCount: number;
  notificationAction: (formData: FormData) => Promise<void>;
};

type PanelMode = "nav" | "profile" | null;

export function TopAppBar({
  appName,
  role,
  locale,
  labels,
  displayName,
  profileAvatarEmoji,
  profileAvatarUrl,
  notifications,
  unreadNotificationCount,
  notificationAction
}: Props) {
  const pathname = usePathname();
  const [panel, setPanel] = useState<PanelMode>(null);
  const [navTab, setNavTab] = useState<"main" | "more">("main");
  const [profileTab, setProfileTab] = useState<"account" | "settings">("account");
  const isKo = locale === "ko";

  const ui = useMemo(
    () => ({
      mainTabs: isKo ? "Main" : "Main Tabs",
      more: isKo ? "More" : "More",
      workspace: isKo ? "Secondary" : "Secondary",
      profile: isKo ? "Profile" : "Profile",
      settings: isKo ? "Settings" : "Settings",
      currentRole: isKo ? "Current Role" : "Current Role",
      manager: isKo ? "Manager" : "Manager",
      language: isKo ? "Language" : "Language",
      applyLanguage: isKo ? "Apply Language" : "Apply language",
      signOut: isKo ? "Sign out" : "Sign out",
      quickWellness: isKo ? "Wellness" : "Wellness"
    }),
    [isKo]
  );

  const mainTabs = [
    { href: "/app/welcome", label: labels.questions, icon: House },
    { href: "/app/record", label: labels.record, icon: BarChart3 },
    { href: "/app/rewards", label: labels.rewards, icon: Gift },
    { href: "/app/score", label: labels.score, icon: Star },
    { href: "/app/rules", label: labels.rules, icon: Shield }
  ] as const;

  const moreTabs = [
    { href: "/app/food", label: "Food", icon: Utensils },
    { href: "/app/workout", label: "Workout", icon: Dumbbell },
    { href: "/app/sleep", label: "Sleep", icon: Moon },
    { href: "/account", label: labels.account, icon: CircleUserRound }
  ] as const;

  function openNav() {
    setNavTab("main");
    setPanel("nav");
  }

  function openProfile() {
    setProfileTab("account");
    setPanel("profile");
  }

  function closePanel() {
    setPanel(null);
  }

  function isSelected(href: string): boolean {
    if (href === "/app/welcome") {
      return pathname === "/app/welcome" || pathname.startsWith("/app/questions") || pathname.startsWith("/app/plan") || pathname.startsWith("/app/mission") || pathname.startsWith("/app/food") || pathname.startsWith("/app/workout") || pathname.startsWith("/app/sleep");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/50 pt-[var(--safe-top)] glass">
        <div className="container-mobile flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-900">
            <button
              aria-label="Open side menu"
              className="rounded-full bg-indigo-100 p-2 text-indigo-900"
              onClick={openNav}
              type="button"
            >
              <Menu size={18} />
            </button>
            <Link className="display-cute text-xl font-bold" href="/app/welcome">
              {appName}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell
              action={notificationAction}
              locale={locale}
              notifications={notifications}
              role={role}
              unreadCount={unreadNotificationCount}
            />
            <button
              aria-label="Open profile panel"
              className="rounded-full bg-indigo-100 p-1 text-indigo-900"
              onClick={openProfile}
              type="button"
            >
              <ProfileAvatar
                className="ring-indigo-200"
                emoji={profileAvatarEmoji}
                imageUrl={profileAvatarUrl}
                name={displayName}
                size={30}
              />
            </button>
          </div>
        </div>
      </header>

      {panel && (
        <div className="fixed inset-0 z-50 bg-slate-950/35" onClick={closePanel}>
          <div
            className={`anim-pop h-full w-[84%] max-w-[20rem] bg-white p-4 shadow-2xl ${panel === "profile" ? "ml-auto" : ""}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="display-cute text-xl text-indigo-900">{panel === "nav" ? appName : labels.account}</p>
              <button
                aria-label="Close panel"
                className="rounded-full bg-slate-100 p-2"
                onClick={closePanel}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            {panel === "nav" ? (
              <>
                <div className="mb-3 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                  <button
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${navTab === "main" ? "bg-white text-indigo-900" : "text-slate-600"}`}
                    onClick={() => setNavTab("main")}
                    type="button"
                  >
                    {ui.mainTabs}
                  </button>
                  <button
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${navTab === "more" ? "bg-white text-indigo-900" : "text-slate-600"}`}
                    onClick={() => setNavTab("more")}
                    type="button"
                  >
                    {ui.more}
                  </button>
                </div>

                {navTab === "main" ? (
                  <nav className="space-y-2">
                    {mainTabs.map((tab) => {
                      const Icon = tab.icon;
                      const selected = isSelected(tab.href);
                      return (
                        <Link
                          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${selected ? "bg-indigo-100 text-indigo-900" : "bg-slate-100 text-slate-700"}`}
                          href={tab.href}
                          key={tab.href}
                          onClick={closePanel}
                        >
                          <Icon size={16} />
                          {tab.label}
                        </Link>
                      );
                    })}
                  </nav>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{ui.workspace}</p>
                    <nav className="space-y-2">
                      {moreTabs.map((tab) => {
                        const Icon = tab.icon;
                        const selected = isSelected(tab.href);
                        return (
                          <Link
                            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${selected ? "bg-indigo-100 text-indigo-900" : "bg-slate-100 text-slate-700"}`}
                            href={tab.href}
                            key={tab.href}
                            onClick={closePanel}
                          >
                            <Icon size={16} />
                            {tab.label}
                          </Link>
                        );
                      })}
                      {role === "manager" && (
                        <Link className="block rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium" href="/manager" onClick={closePanel}>
                          {ui.manager}
                        </Link>
                      )}
                    </nav>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                  <button
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${profileTab === "account" ? "bg-white text-indigo-900" : "text-slate-600"}`}
                    onClick={() => setProfileTab("account")}
                    type="button"
                  >
                    {ui.profile}
                  </button>
                  <button
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${profileTab === "settings" ? "bg-white text-indigo-900" : "text-slate-600"}`}
                    onClick={() => setProfileTab("settings")}
                    type="button"
                  >
                    {ui.settings}
                  </button>
                </div>

                {profileTab === "account" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 rounded-xl bg-slate-100 p-3">
                      <ProfileAvatar
                        emoji={profileAvatarEmoji}
                        imageUrl={profileAvatarUrl}
                        name={displayName}
                        size={40}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-indigo-900">{displayName || "Work Monster"}</p>
                        <p className="text-xs text-slate-500">{role}</p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-100 p-3 text-sm">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{ui.currentRole}</p>
                      <p className="mt-1 font-semibold text-indigo-900">{role}</p>
                    </div>
                    <Link href="/account" className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium" onClick={closePanel}>
                      <CircleUserRound size={16} />
                      {labels.account}
                    </Link>
                    {role === "manager" && (
                      <Link href="/manager" className="block rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium" onClick={closePanel}>
                        {ui.manager}
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <form action={setLocaleAction} className="mb-2">
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{ui.language}</label>
                      <select name="locale" defaultValue={locale} className="input text-sm">
                        <option value="en">English</option>
                        <option value="ko">한국어</option>
                      </select>
                      <button className="btn btn-muted mt-2 w-full text-sm" type="submit">
                        {ui.applyLanguage}
                      </button>
                    </form>
                    <button className="btn btn-muted w-full text-sm" disabled type="button">
                      <span className="inline-flex items-center gap-2">
                        <Settings2 size={15} />
                        {ui.quickWellness}
                      </span>
                    </button>
                    <form action={logoutAction}>
                      <button className="btn btn-primary w-full text-sm" type="submit">
                        {ui.signOut}
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

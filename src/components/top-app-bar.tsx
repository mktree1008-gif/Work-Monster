"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleUserRound, Compass, Menu, UserRound, X } from "lucide-react";
import { Locale, UserRole } from "@/lib/types";
import { logoutAction, setLocaleAction } from "@/lib/services/actions";

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
};

type PanelMode = "nav" | "profile" | null;

export function TopAppBar({ appName, role, locale, labels }: Props) {
  const [panel, setPanel] = useState<PanelMode>(null);
  const [navTab, setNavTab] = useState<"main" | "more">("main");
  const [profileTab, setProfileTab] = useState<"account" | "settings">("account");

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

  const ui =
    locale === "ko"
      ? {
          mainTabs: "메인 탭",
          more: "더보기",
          workspace: "워크스페이스",
          profile: "프로필",
          settings: "설정",
          currentRole: "현재 역할",
          manager: "매니저",
          language: "언어",
          applyLanguage: "언어 적용",
          signOut: "로그아웃"
        }
      : {
          mainTabs: "Main Tabs",
          more: "More",
          workspace: "Workspace",
          profile: "Profile",
          settings: "Settings",
          currentRole: "Current Role",
          manager: "Manager",
          language: "Language",
          applyLanguage: "Apply language",
          signOut: "Sign out"
        };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/50 glass">
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
            <span className="display-cute text-2xl font-bold">{appName}</span>
          </div>
          <button
            aria-label="Open profile panel"
            className="rounded-full bg-indigo-100 p-2 text-indigo-900"
            onClick={openProfile}
            type="button"
          >
            <UserRound size={18} />
          </button>
        </div>
      </header>

      {panel && (
        <div className="fixed inset-0 z-50 bg-slate-950/35" onClick={closePanel}>
          <div
            className={`h-full w-[82%] max-w-xs bg-white p-4 shadow-2xl ${panel === "profile" ? "ml-auto" : ""}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="display-cute text-2xl text-indigo-900">{panel === "nav" ? appName : labels.account}</p>
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
                    <Link href="/app/questions" className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium" onClick={closePanel}>
                      <Compass size={16} />
                      {labels.questions}
                    </Link>
                    <Link href="/app/record" className="block rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium" onClick={closePanel}>
                      {labels.record}
                    </Link>
                    <Link href="/app/rewards" className="block rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium" onClick={closePanel}>
                      {labels.rewards}
                    </Link>
                    <Link href="/app/score" className="block rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium" onClick={closePanel}>
                      {labels.score}
                    </Link>
                    <Link href="/app/rules" className="block rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium" onClick={closePanel}>
                      {labels.rules}
                    </Link>
                  </nav>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{ui.workspace}</p>
                    {role === "manager" && (
                      <Link href="/manager" className="block rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium" onClick={closePanel}>
                        {ui.manager}
                      </Link>
                    )}
                    <Link href="/account" className="block rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium" onClick={closePanel}>
                      {labels.account}
                    </Link>
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

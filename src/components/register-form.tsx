"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, MailPlus, UserRound } from "lucide-react";
import { Locale, UserRole } from "@/lib/types";

type Props = {
  initialRole?: UserRole;
  initialLocale?: Locale;
};

export function RegisterForm({ initialRole = "user", initialLocale = "en" }: Props) {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nickname, setNickname] = useState("");
  const [nicknamePending, setNicknamePending] = useState(false);
  const [nicknameError, setNicknameError] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const copy = {
    title: "Create account",
    user: "User",
    manager: "Manager",
    language: "Language",
    id: "ID or Email",
    idHint: "You can use an email or a custom ID like monster_id.",
    password: "Security Key",
    confirm: "Confirm Security Key",
    submit: "Create account",
    creating: "Creating...",
    mismatch: "Security keys do not match.",
    back: "Already have an account? Log in",
    nicknameTitle: "Set your nickname",
    nicknameSubtitle: "This is the name shown inside Work Monster.",
    nicknameSave: "Save nickname",
    nicknameSaving: "Saving nickname...",
    nicknameFailed: "Nickname update failed."
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError(copy.mismatch);
      return;
    }

    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password, role, locale })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Account creation failed.");
      }

      await response.json();
      const normalized = loginId.trim();
      const suggested = normalized.includes("@") ? normalized.split("@")[0] ?? "" : normalized;
      setNickname(suggested || "Player");
      setShowNicknameModal(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account creation failed.");
    } finally {
      setPending(false);
    }
  }

  async function onSubmitNickname(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNicknamePending(true);
    setNicknameError("");
    try {
      const response = await fetch("/api/auth/nickname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname })
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? copy.nicknameFailed);
      }
      const payload = (await response.json()) as { redirectTo: string };
      setShowNicknameModal(false);
      router.push(payload.redirectTo);
      router.refresh();
    } catch (caught) {
      setNicknameError(caught instanceof Error ? caught.message : copy.nicknameFailed);
    } finally {
      setNicknamePending(false);
    }
  }

  return (
    <>
      <form className="px-6 pb-6" onSubmit={onSubmit}>
        <p className="mb-3 text-center text-sm font-semibold text-indigo-900">{copy.title}</p>

        <div className="mb-4 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
          <button
            className={`rounded-xl px-4 py-2 text-sm font-bold ${role === "user" ? "bg-white text-indigo-900" : "text-slate-600"}`}
            onClick={() => setRole("user")}
            type="button"
          >
            {copy.user}
          </button>
          <button
            className={`rounded-xl px-4 py-2 text-sm font-bold ${role === "manager" ? "bg-white text-indigo-900" : "text-slate-600"}`}
            onClick={() => setRole("manager")}
            type="button"
          >
            {copy.manager}
          </button>
        </div>

        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{copy.language}</label>
        <select className="input mb-4" onChange={(event) => setLocale(event.target.value as Locale)} value={locale}>
          <option value="en">English</option>
          <option value="ko">한국어</option>
        </select>

        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{copy.id}</label>
        <div className="relative">
          <MailPlus className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            autoComplete="username"
            className="input pl-12"
            onChange={(event) => setLoginId(event.target.value)}
            placeholder="monster_id or alex@work.com"
            type="text"
            value={loginId}
          />
        </div>
        <p className="mb-4 mt-2 text-xs text-slate-500">{copy.idHint}</p>

        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{copy.password}</label>
        <div className="relative mb-4">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            autoComplete="new-password"
            className="input pl-12"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            type="password"
            value={password}
          />
        </div>

        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{copy.confirm}</label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            autoComplete="new-password"
            className="input pl-12"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="••••••••"
            type="password"
            value={confirmPassword}
          />
        </div>

        <button className="btn btn-primary mt-6 w-full" disabled={pending} type="submit">
          {pending ? copy.creating : copy.submit}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link
            className="font-semibold text-indigo-700 underline decoration-indigo-200 underline-offset-4"
            href={`/auth/login?role=${role}&locale=${locale}`}
          >
            {copy.back}
          </Link>
        </p>

        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </form>

      {showNicknameModal && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="container-mobile card anim-pop p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Welcome</p>
            <h3 className="mt-1 text-2xl font-black text-indigo-900">{copy.nicknameTitle}</h3>
            <p className="mt-1 text-sm text-slate-600">{copy.nicknameSubtitle}</p>
            <form className="mt-4" onSubmit={onSubmitNickname}>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Nickname</label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  autoComplete="nickname"
                  className="input pl-12"
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="e.g. Focus Rider"
                  type="text"
                  value={nickname}
                />
              </div>
              <button className="btn btn-primary mt-4 w-full" disabled={nicknamePending} type="submit">
                {nicknamePending ? copy.nicknameSaving : copy.nicknameSave}
              </button>
              {nicknameError && <p className="mt-2 text-sm text-rose-600">{nicknameError}</p>}
            </form>
          </div>
        </div>
      )}
    </>
  );
}

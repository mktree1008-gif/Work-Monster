"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail, Sparkles, Zap } from "lucide-react";
import { GoogleLoginButton } from "@/components/google-login-button";
import { ChibiAvatar } from "@/components/chibi-avatar";
import { Locale, UserRole } from "@/lib/types";

type Props = {
  initialRole?: UserRole;
  initialLocale?: Locale;
};

export function LoginForm({ initialRole = "user", initialLocale = "en" }: Props) {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const copy = {
    user: "User",
    manager: "Manager",
    language: "Language",
    id: "ID or Email",
    password: "Security Key",
    enter: "Enter Sanctuary",
    create: "Create account",
    createHint: "Need an account?",
    entering: "Entering...",
    failed: "Login failed."
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password, role, locale })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? copy.failed);
      }

      const payload = (await response.json()) as { redirectTo: string };
      setRedirectTo(payload.redirectTo);
      setShowWelcome(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.failed);
    } finally {
      setPending(false);
    }
  }

  function continueToApp() {
    if (!redirectTo) return;
    router.push(redirectTo);
    router.refresh();
  }

  function onAuthSuccess(nextPath: string) {
    setRedirectTo(nextPath);
    setShowWelcome(true);
  }

  return (
    <>
      <form className="px-6 pb-6" onSubmit={onSubmit}>
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
          <Mail className="absolute left-3 top-3.5 text-slate-400" size={18} />
          <input
            autoComplete="username"
            className="input mb-4 pl-10"
            onChange={(event) => setLoginId(event.target.value)}
            placeholder="monster_id or alex@work.com"
            type="text"
            value={loginId}
          />
        </div>

        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{copy.password}</label>
        <div className="relative">
          <LockKeyhole className="absolute left-3 top-3.5 text-slate-400" size={18} />
          <input
            autoComplete="current-password"
            className="input pl-10"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            type="password"
            value={password}
          />
        </div>

        <button className="btn btn-primary mt-6 w-full" disabled={pending} type="submit">
          {pending ? copy.entering : copy.enter}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          {copy.createHint}{" "}
          <Link
            className="font-semibold text-indigo-700 underline decoration-indigo-200 underline-offset-4"
            href={`/auth/register?role=${role}&locale=${locale}`}
          >
            {copy.create}
          </Link>
        </p>

        <GoogleLoginButton locale={locale} onSuccessRedirect={onAuthSuccess} role={role} />
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </form>

      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="container-mobile card anim-pop relative overflow-hidden p-5 text-center">
            <div className="pointer-events-none absolute inset-0">
              <span className="anim-bounce-soft absolute left-[12%] top-6 text-xl">✨</span>
              <span className="anim-float absolute left-[78%] top-8 text-lg">⭐</span>
              <span className="anim-pulse-soft absolute left-[24%] top-16 text-lg">🎉</span>
              <span className="anim-float absolute left-[68%] top-16 text-lg">🚀</span>
            </div>

            <div className="relative flex items-center justify-center gap-3">
              <ChibiAvatar className="anim-float" emotion="excited" role="manager" size={62} />
              <ChibiAvatar className="anim-bounce-soft" emotion="approval" role="user" size={62} />
            </div>
            <p className="relative mt-4 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Login success</p>
            <h3 className="relative mt-1 text-3xl font-black text-indigo-900">Welcome Work Monster!</h3>
            <p className="relative mt-1 text-sm text-slate-600">Your quest is ready. Let&apos;s build momentum.</p>

            <button
              className="btn btn-energetic relative mt-4 flex w-full items-center justify-center gap-2"
              onClick={continueToApp}
              type="button"
            >
              <Zap size={16} />
              <Sparkles className="anim-pulse-soft" size={16} />
              Continue
            </button>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail } from "lucide-react";
import { AnimatedCelebrationPopup } from "@/components/animated-celebration-popup";
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
  const [loginBonusPoints, setLoginBonusPoints] = useState(0);
  const [loginBonusAwarded, setLoginBonusAwarded] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const copy = {
    user: "User",
    manager: "Manager",
    language: "Language",
    id: "ID or Email",
    password: "Security Key",
    enter: "Log In",
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

      const payload = (await response.json()) as {
        redirectTo: string;
        loginPointsAwarded?: boolean;
        loginPoints?: number;
      };
      const loginPoints =
        typeof payload.loginPoints === "number" && Number.isFinite(payload.loginPoints)
          ? payload.loginPoints
          : 0;
      setRedirectTo(payload.redirectTo);
      setLoginBonusAwarded(Boolean(payload.loginPointsAwarded));
      setLoginBonusPoints(loginPoints);
      setShowWelcome(true);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : copy.failed;
      setError(message);
      if (message.includes("권한이 없습니다")) {
        setAccessDeniedMessage(message);
      }
    } finally {
      setPending(false);
    }
  }

  function continueToApp() {
    if (!redirectTo) return;
    router.push(redirectTo);
    router.refresh();
  }

  function onAuthSuccess(result: { redirectTo: string; loginPointsAwarded?: boolean; loginPoints?: number }) {
    const loginPoints =
      typeof result.loginPoints === "number" && Number.isFinite(result.loginPoints)
        ? result.loginPoints
        : 0;
    setRedirectTo(result.redirectTo);
    setLoginBonusAwarded(Boolean(result.loginPointsAwarded));
    setLoginBonusPoints(loginPoints);
    setShowWelcome(true);
  }

  function onAuthError(message: string) {
    if (message.includes("권한이 없습니다")) {
      setAccessDeniedMessage(message);
    }
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
          <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            autoComplete="username"
            className="input input-with-icon mb-4"
            onChange={(event) => setLoginId(event.target.value)}
            placeholder="monster_id or alex@work.com"
            type="text"
            value={loginId}
          />
        </div>

        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{copy.password}</label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            autoComplete="current-password"
            className="input input-with-icon"
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

        <GoogleLoginButton locale={locale} onError={onAuthError} onSuccessRedirect={onAuthSuccess} role={role} />
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </form>

      <AnimatedCelebrationPopup
        characterMode="both"
        closeLabel="Continue"
        managerEmotion="encouraging"
        message={
          loginBonusAwarded
            ? "Dance time! Your daily login bonus is now reflected in Score."
            : "Your quest is ready. Let’s build momentum."
        }
        onClose={continueToApp}
        open={showWelcome}
        pointsLabel={
          loginBonusAwarded
            ? `💃 +${loginBonusPoints} points! Daily login bonus`
            : "No login bonus this time"
        }
        progressCaption={loginBonusAwarded ? "Daily bonus applied" : "Login completed"}
        progressTarget={100}
        title={loginBonusAwarded ? "Welcome Back, Bonus Added!" : "Welcome Work Monster!"}
        userEmotion="excited"
      />

      {accessDeniedMessage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="container-mobile card anim-pop p-5 text-center">
            <div className="mb-3 flex items-center justify-center gap-2">
              <ChibiAvatar className="anim-shake-soft" emotion="alert" role="manager" size={52} />
              <span className="text-xl">🚫</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-600">Manager Access</p>
            <h3 className="mt-1 text-2xl font-black text-indigo-900">권한이 없습니다</h3>
            <p className="mt-2 text-sm text-slate-600">{accessDeniedMessage}</p>
            <button className="btn btn-primary mt-4 w-full" onClick={() => setAccessDeniedMessage("")} type="button">
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}

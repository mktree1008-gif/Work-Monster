"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail } from "lucide-react";
import { GoogleLoginButton } from "@/components/google-login-button";
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
      router.push(payload.redirectTo);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.failed);
    } finally {
      setPending(false);
    }
  }

  return (
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

      <GoogleLoginButton locale={locale} role={role} />
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </form>
  );
}

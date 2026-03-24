"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail } from "lucide-react";
import { GoogleLoginButton } from "@/components/google-login-button";
import { Locale, UserRole } from "@/lib/types";

export function LoginForm() {
  const [role, setRole] = useState<UserRole>("user");
  const [locale, setLocale] = useState<Locale>("en");
  const [loginId, setLoginId] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const copy =
    locale === "ko"
      ? {
          user: "사용자",
          manager: "매니저",
          language: "언어",
          id: "로그인 ID",
          nickname: "닉네임",
          password: "보안 키",
          enter: "입장하기",
          create: "계정 생성",
          entering: "입장 중...",
          creating: "생성 중...",
          failed: "로그인에 실패했어요."
        }
      : {
          user: "User",
          manager: "Manager",
          language: "Language",
          id: "Login ID",
          nickname: "Nickname",
          password: "Security Key",
          enter: "Enter Sanctuary",
          create: "Create account",
          entering: "Entering...",
          creating: "Creating...",
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

  async function onCreateAccount() {
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, nickname, password, role, locale })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Account creation failed.");
      }

      const payload = (await response.json()) as { redirectTo: string };
      router.push(payload.redirectTo);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account creation failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="card p-6" onSubmit={onSubmit}>
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
          placeholder="monster_id"
          type="text"
          value={loginId}
        />
      </div>

      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{copy.nickname}</label>
      <div className="relative">
        <input
          autoComplete="nickname"
          className="input mb-4"
          onChange={(event) => setNickname(event.target.value)}
          placeholder="Monster Hero"
          type="text"
          value={nickname}
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
      <button className="btn btn-muted mt-2 w-full" disabled={pending} onClick={onCreateAccount} type="button">
        {pending ? copy.creating : copy.create}
      </button>

      <GoogleLoginButton locale={locale} role={role} />
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </form>
  );
}

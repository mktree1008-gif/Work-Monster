"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole, MailPlus } from "lucide-react";
import { Locale, UserRole } from "@/lib/types";

export function RegisterForm() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") === "manager" ? "manager" : "user";
  const initialLocale = searchParams.get("locale") === "ko" ? "ko" : "en";
  const [role, setRole] = useState<UserRole>(initialRole);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const copy = useMemo(
    () =>
      locale === "ko"
        ? {
            title: "계정 만들기",
            user: "사용자",
            manager: "매니저",
            language: "언어",
            id: "아이디 또는 이메일",
            idHint: "이메일 형식 또는 monster_id 같은 임의 ID를 사용할 수 있어요.",
            password: "보안 키",
            confirm: "보안 키 확인",
            submit: "계정 생성 후 닉네임 설정",
            creating: "생성 중...",
            mismatch: "보안 키가 서로 달라요.",
            back: "이미 계정이 있어요? 로그인"
          }
        : {
            title: "Create account",
            user: "User",
            manager: "Manager",
            language: "Language",
            id: "ID or Email",
            idHint: "You can use an email or a custom ID like monster_id.",
            password: "Security Key",
            confirm: "Confirm Security Key",
            submit: "Create account and set nickname",
            creating: "Creating...",
            mismatch: "Security keys do not match.",
            back: "Already have an account? Log in"
          },
    [locale]
  );

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
        <MailPlus className="absolute left-3 top-3.5 text-slate-400" size={18} />
        <input
          autoComplete="username"
          className="input pl-10"
          onChange={(event) => setLoginId(event.target.value)}
          placeholder="monster_id or alex@work.com"
          type="text"
          value={loginId}
        />
      </div>
      <p className="mb-4 mt-2 text-xs text-slate-500">{copy.idHint}</p>

      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{copy.password}</label>
      <div className="relative mb-4">
        <LockKeyhole className="absolute left-3 top-3.5 text-slate-400" size={18} />
        <input
          autoComplete="new-password"
          className="input pl-10"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          type="password"
          value={password}
        />
      </div>

      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{copy.confirm}</label>
      <div className="relative">
        <LockKeyhole className="absolute left-3 top-3.5 text-slate-400" size={18} />
        <input
          autoComplete="new-password"
          className="input pl-10"
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
  );
}

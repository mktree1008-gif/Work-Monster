"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, UserRound } from "lucide-react";

type Props = {
  loginId: string;
  suggestedName: string;
};

export function NicknameForm({ loginId, suggestedName }: Props) {
  const [nickname, setNickname] = useState(suggestedName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const copy = {
    title: "Pick your nickname",
    subtitle: "This is how Work Monster will call you.",
    nickname: "Nickname",
    helper: `Login ID: ${loginId}`,
    save: "Save nickname and continue",
    saving: "Saving...",
    failed: "Nickname update failed."
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/auth/nickname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname })
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
      <div className="mb-4 rounded-2xl bg-indigo-50 p-4 text-indigo-900">
        <p className="text-base font-bold">{copy.title}</p>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={16} />
          {copy.subtitle}
        </div>
        <p className="text-xs text-indigo-700">{copy.helper}</p>
      </div>

      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{copy.nickname}</label>
      <div className="relative">
        <UserRound className="absolute left-3 top-3.5 text-slate-400" size={18} />
        <input
          autoComplete="nickname"
          className="input pl-10"
          onChange={(event) => setNickname(event.target.value)}
          placeholder="e.g. Focus Rider"
          type="text"
          value={nickname}
        />
      </div>

      <button className="btn btn-primary mt-6 w-full" disabled={pending} type="submit">
        {pending ? copy.saving : copy.save}
      </button>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </form>
  );
}

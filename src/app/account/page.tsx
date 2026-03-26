import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { logoutAction, setLocaleAction, updateNicknameAction } from "@/lib/services/actions";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { ProfileAvatar } from "@/components/profile-avatar";
import { ProfileAvatarEditor } from "@/components/profile-avatar-editor";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const repo = getGameRepository();
  const user = await repo.getUser(session.uid);
  if (!user) redirect("/auth/login");
  const params = (searchParams ? await searchParams : {}) as Record<string, string | string[] | undefined>;
  const nicknameSaved = params.nickname_saved === "1";
  const displayName = (user.name ?? "").trim() || user.login_id;

  return (
    <main className="container-mobile page-padding">
      <div className="mb-3">
        <Link className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-semibold text-indigo-700 shadow-sm" href="/app/welcome">
          <ArrowLeft size={16} />
          Back
        </Link>
      </div>
      <section className="card p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Account</p>
        <h1 className="display-cute mt-2 text-4xl text-indigo-900">{displayName}</h1>
        <p className="text-sm text-slate-600">ID: {user.login_id}</p>
        {user.email && <p className="text-sm text-slate-600">Email: {user.email}</p>}
        <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-sm">Role: {user.role}</p>

        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-100 p-3">
          <ProfileAvatar
            emoji={user.profile_avatar_emoji}
            imageUrl={user.profile_avatar_url}
            name={displayName}
            size={56}
          />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Profile image</p>
            <p className="text-sm font-semibold text-indigo-900">Visible on your app header and profile.</p>
          </div>
        </div>

        {nicknameSaved && (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            Nickname updated successfully.
          </p>
        )}

        <form action={updateNicknameAction} className="mt-4 rounded-2xl bg-slate-100 p-3">
          <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">Nickname</label>
          <input
            className="input"
            defaultValue={user.name || displayName}
            maxLength={24}
            minLength={2}
            name="nickname"
            placeholder="Enter nickname"
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            This name appears across the app. Google login keeps your current Google name as the initial default.
          </p>
          <button className="btn btn-primary mt-3 w-full" type="submit">
            Save nickname
          </button>
        </form>

        <form action={setLocaleAction} className="mt-4">
          <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">Language</label>
          <select className="input" defaultValue={user.locale} name="locale">
            <option value="en">English</option>
            <option value="ko">한국어</option>
          </select>
          <button className="btn btn-primary mt-3 w-full" type="submit">
            Save language
          </button>
        </form>

        <ProfileAvatarEditor
          initialEmoji={user.profile_avatar_emoji ?? "😺"}
          initialImageUrl={user.profile_avatar_url ?? ""}
          initialMode={user.profile_avatar_type ?? "emoji"}
          locale={user.locale}
        />

        <form action={logoutAction} className="mt-2">
          <button className="btn btn-muted w-full" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}

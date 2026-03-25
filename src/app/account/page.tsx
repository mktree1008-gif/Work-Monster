import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { logoutAction, setLocaleAction } from "@/lib/services/actions";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { CharacterAlert } from "@/components/character-alert";
import { ProfileAvatar } from "@/components/profile-avatar";
import { getUserCue } from "@/lib/character-system";
import { ProfileAvatarEditor } from "@/components/profile-avatar-editor";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const repo = getGameRepository();
  const user = await repo.getUser(session.uid);
  if (!user) redirect("/auth/login");
  const displayName = (user.name ?? "").trim() || user.login_id;
  const characterCue = getUserCue("score_confident", user.locale);

  return (
    <main className="container-mobile page-padding">
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

        <div className="mt-4">
          <CharacterAlert role="user" cue={characterCue} compact />
        </div>

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

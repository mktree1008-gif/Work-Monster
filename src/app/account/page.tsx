import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { logoutAction, setLocaleAction, updateProfileAvatarAction } from "@/lib/services/actions";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { CharacterAlert } from "@/components/character-alert";
import { ProfileAvatar } from "@/components/profile-avatar";
import { getUserCue } from "@/lib/character-system";

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

        <details className="mt-3 rounded-2xl bg-slate-50 p-3">
          <summary className="cursor-pointer list-none text-sm font-bold text-indigo-700">Edit profile image</summary>
          <form action={updateProfileAvatarAction} className="mt-3 space-y-3" encType="multipart/form-data">
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">Style</span>
              <select className="input" defaultValue={user.profile_avatar_type ?? "emoji"} name="avatar_mode">
                <option value="emoji">Emoji avatar</option>
                <option value="image">Photo/Image avatar</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">Emoji</span>
              <input
                className="input"
                defaultValue={user.profile_avatar_emoji ?? "😺"}
                name="avatar_emoji"
                placeholder="😺"
                type="text"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">Image URL</span>
              <input
                className="input"
                defaultValue={user.profile_avatar_url ?? ""}
                name="avatar_url"
                placeholder="https://..."
                type="url"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">Or upload photo (max 2MB)</span>
              <input className="input cursor-pointer" accept="image/*" name="avatar_file" type="file" />
            </label>

            <button className="btn btn-primary w-full" type="submit">
              Save profile image
            </button>
          </form>
        </details>

        <form action={logoutAction} className="mt-2">
          <button className="btn btn-muted w-full" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}

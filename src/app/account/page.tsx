import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { logoutAction, setLocaleAction } from "@/lib/services/actions";
import { getGameRepository } from "@/lib/repositories/game-repository";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const repo = getGameRepository();
  const user = await repo.getUser(session.uid);
  if (!user) redirect("/auth/login");
  const displayName = (user.name ?? "").trim() || user.login_id;

  return (
    <main className="container-mobile page-padding">
      <section className="card p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Account</p>
        <h1 className="display-cute mt-2 text-4xl text-indigo-900">{displayName}</h1>
        <p className="text-sm text-slate-600">ID: {user.login_id}</p>
        {user.email && <p className="text-sm text-slate-600">Email: {user.email}</p>}
        <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-sm">Role: {user.role}</p>

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

        <form action={logoutAction} className="mt-2">
          <button className="btn btn-muted w-full" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}

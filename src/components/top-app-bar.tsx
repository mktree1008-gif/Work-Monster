import Link from "next/link";
import { Menu, UserRound } from "lucide-react";
import { Locale, UserRole } from "@/lib/types";
import { logoutAction, setLocaleAction } from "@/lib/services/actions";

type Props = {
  appName: string;
  role: UserRole;
  locale: Locale;
  accountLabel: string;
};

export function TopAppBar({ appName, role, locale, accountLabel }: Props) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/50 glass">
      <div className="container-mobile flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-900">
          <Menu size={20} />
          <span className="display-cute text-2xl font-bold">{appName}</span>
        </div>
        <details className="relative">
          <summary className="list-none cursor-pointer rounded-full bg-indigo-100 p-2 text-indigo-900">
            <UserRound size={18} />
          </summary>
          <div className="absolute right-0 mt-3 w-52 rounded-2xl bg-white p-3 shadow-2xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{role}</p>
            {role === "manager" && (
              <Link href="/manager" className="mb-2 block rounded-xl bg-slate-100 px-3 py-2 text-sm">
                Manager
              </Link>
            )}
            <Link href="/account" className="mb-2 block rounded-xl bg-slate-100 px-3 py-2 text-sm">
              {accountLabel}
            </Link>
            <form action={setLocaleAction} className="mb-2">
              <select name="locale" defaultValue={locale} className="input text-sm">
                <option value="en">English</option>
                <option value="ko">한국어</option>
              </select>
              <button className="btn btn-muted mt-2 w-full text-sm" type="submit">
                Apply language
              </button>
            </form>
            <form action={logoutAction}>
              <button className="btn btn-primary w-full text-sm" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}

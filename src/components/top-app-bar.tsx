"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, UserRound, X } from "lucide-react";
import { Locale, UserRole } from "@/lib/types";
import { logoutAction, setLocaleAction } from "@/lib/services/actions";

type Props = {
  appName: string;
  role: UserRole;
  locale: Locale;
  accountLabel: string;
};

export function TopAppBar({ appName, role, locale, accountLabel }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/50 glass">
        <div className="container-mobile flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-900">
            <button
              aria-label="Open side menu"
              className="rounded-full bg-indigo-100 p-2 text-indigo-900"
              onClick={() => setOpen(true)}
              type="button"
            >
              <Menu size={18} />
            </button>
            <span className="display-cute text-2xl font-bold">{appName}</span>
          </div>
          <div className="rounded-full bg-indigo-100 p-2 text-indigo-900">
            <UserRound size={18} />
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/35" onClick={() => setOpen(false)}>
          <div
            className="h-full w-[82%] max-w-xs bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="display-cute text-2xl text-indigo-900">{appName}</p>
              <button
                aria-label="Close side menu"
                className="rounded-full bg-slate-100 p-2"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{role}</p>
            {role === "manager" && (
              <Link
                href="/manager"
                className="mb-2 block rounded-xl bg-slate-100 px-3 py-2 text-sm"
                onClick={() => setOpen(false)}
              >
                Manager
              </Link>
            )}
            <Link
              href="/account"
              className="mb-2 block rounded-xl bg-slate-100 px-3 py-2 text-sm"
              onClick={() => setOpen(false)}
            >
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
        </div>
      )}
    </>
  );
}

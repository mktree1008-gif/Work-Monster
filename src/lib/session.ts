import { cookies } from "next/headers";
import { Locale, UserRole } from "@/lib/types";

export const UID_COOKIE = "wm_uid";
export const ROLE_COOKIE = "wm_role";
export const LOCALE_COOKIE = "wm_locale";

export interface Session {
  uid: string;
  role: UserRole;
  locale: Locale;
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const uid = store.get(UID_COOKIE)?.value;
  const role = store.get(ROLE_COOKIE)?.value as UserRole | undefined;
  const locale = store.get(LOCALE_COOKIE)?.value as Locale | undefined;

  if (!uid || !role || !locale) return null;
  return { uid, role, locale };
}

export async function setSession(payload: Session): Promise<void> {
  const store = await cookies();
  store.set(UID_COOKIE, payload.uid, { httpOnly: true, sameSite: "lax", path: "/" });
  store.set(ROLE_COOKIE, payload.role, { httpOnly: true, sameSite: "lax", path: "/" });
  store.set(LOCALE_COOKIE, payload.locale, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function updateLocale(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(UID_COOKIE);
  store.delete(ROLE_COOKIE);
  store.delete(LOCALE_COOKIE);
}

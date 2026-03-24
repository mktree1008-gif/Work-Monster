import { redirect } from "next/navigation";
import { dictionary } from "@/lib/i18n";
import { getSession } from "@/lib/session";
import { getDashboard } from "@/lib/services/game-service";

export async function getViewerContext() {
  const session = await getSession();
  if (!session) {
    redirect("/auth/login");
  }

  const bundle = await getDashboard(session.uid);
  if ((bundle.user.name ?? "").trim().length === 0) {
    redirect("/auth/nickname");
  }
  const strings = dictionary[bundle.user.locale] ?? dictionary.en;

  return {
    session,
    bundle,
    strings
  };
}

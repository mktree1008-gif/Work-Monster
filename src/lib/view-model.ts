import { redirect } from "next/navigation";
import { dictionary } from "@/lib/i18n";
import { getSession } from "@/lib/session";
import { getDashboard } from "@/lib/services/game-service";
import { DashboardBundle } from "@/lib/types";

export async function getViewerContext() {
  const session = await getSession();
  if (!session) {
    redirect("/auth/login");
  }

  let bundle: DashboardBundle | null = null;
  try {
    bundle = await getDashboard(session.uid);
  } catch (_error) {
    redirect("/auth/login");
  }
  if (!bundle) {
    redirect("/auth/login");
  }
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

import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { NicknameForm } from "@/components/nickname-form";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { getSession } from "@/lib/session";

function destinationByRole(role: "user" | "manager") {
  return role === "manager" ? "/manager" : "/app/welcome";
}

export default async function NicknamePage() {
  const session = await getSession();
  if (!session) {
    redirect("/auth/login");
  }

  const repo = getGameRepository();
  const user = await repo.getUser(session.uid);
  if (!user) {
    redirect("/auth/login");
  }

  if ((user.name ?? "").trim().length > 0) {
    redirect(destinationByRole(user.role));
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="container-mobile pb-10 pt-8">
        <section className="card overflow-hidden border border-white/70">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-500 px-6 py-6 text-white">
            <div className="mb-2 inline-flex rounded-full bg-white/15 p-2">
              <Sparkles size={18} />
            </div>
            <h1 className="display-cute text-4xl">Work Monster</h1>
            <p className="mt-1 text-sm text-indigo-50">Set your nickname to jump right in.</p>
          </div>
          <NicknameForm loginId={user.login_id} suggestedName="" />
        </section>
      </div>
    </main>
  );
}

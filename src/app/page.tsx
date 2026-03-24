import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login");
  }

  if (session.role === "manager") {
    redirect("/manager");
  }

  redirect("/app/welcome");
}

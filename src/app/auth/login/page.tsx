import { Compass } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-indigo-200/50 blur-3xl" />
      <div className="container-mobile pb-10 pt-12">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-700 text-white shadow-xl">
            <Compass size={24} />
          </div>
          <h1 className="display-cute text-5xl font-black tracking-tight text-indigo-900">Work Monster</h1>
          <p className="mt-2 text-lg text-slate-500">Design your progress, one habit at a time.</p>
        </header>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-slate-500">New here? Start onboarding after your first login.</p>
      </div>
    </main>
  );
}

import Image from "next/image";
import { Suspense } from "react";
import { Compass, CalendarDays, Star, Target, TrendingUp } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="absolute -right-16 top-12 text-slate-300/40">
        <CalendarDays size={44} />
      </div>
      <div className="absolute right-12 top-44 text-slate-300/30">
        <Star size={36} />
      </div>
      <div className="absolute right-8 top-80 text-slate-300/25">
        <TrendingUp size={40} />
      </div>
      <div className="absolute right-14 top-[26rem] text-slate-300/30">
        <Target size={36} />
      </div>

      <div className="container-mobile pb-10 pt-8">
        <section className="card overflow-hidden border border-white/70">
          <div className="relative h-44 w-full bg-indigo-100">
            <Image
              alt="Work Monster team character illustration"
              className="object-cover"
              fill
              priority
              sizes="(max-width: 480px) 100vw, 420px"
              src="/images/login-hero.svg"
            />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white via-white/80 to-transparent" />
          </div>

          <header className="-mt-4 px-6 pb-2 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-700 text-white shadow-xl">
              <Compass size={20} />
            </div>
            <h1 className="display-cute text-5xl font-black tracking-tight text-indigo-900">Work Monster</h1>
            <p className="mt-1 text-lg text-slate-500">Design your progress, one habit at a time.</p>
          </header>

          <Suspense
            fallback={
              <div className="px-6 pb-6">
                <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </section>

        <p className="mt-6 text-center text-sm text-slate-500">New here? Create an account and set your nickname right after sign-up.</p>
      </div>
    </main>
  );
}

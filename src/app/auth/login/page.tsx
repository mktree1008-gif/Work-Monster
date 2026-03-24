import Image from "next/image";
import { Suspense } from "react";
import { Compass, CalendarDays, Star, Target, TrendingUp } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#f3f4fb]">
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
        <section className="card overflow-hidden border border-white/70 bg-white">
          <div className="relative h-56 w-full overflow-hidden bg-gradient-to-b from-indigo-100 via-[#e9edff] to-[#f8f9ff]">
            <div className="absolute left-1/2 top-5 h-[176px] w-[286px] -translate-x-1/2 rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,#ccd3f7_0%,#bec8f1_100%)] shadow-[0_12px_28px_rgba(67,87,170,0.24)]" />
            <Image
              alt="Work Monster team character illustration"
              className="anim-float object-contain px-2 pt-2"
              fill
              priority
              sizes="(max-width: 480px) 100vw, 420px"
              src="/images/login-hero.svg"
              style={{ objectPosition: "center 35%" }}
            />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white via-white/95 to-transparent" />
          </div>

          <header className="-mt-1 px-6 pb-2 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-700 text-white shadow-xl shadow-indigo-300/40">
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

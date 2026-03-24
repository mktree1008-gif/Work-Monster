import Image from "next/image";
import { Compass } from "lucide-react";
import { RegisterForm } from "@/components/register-form";

export default function RegisterPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="container-mobile pb-10 pt-8">
        <section className="card overflow-hidden border border-white/70">
          <div className="relative h-40 w-full bg-indigo-100">
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
            <h1 className="display-cute text-4xl font-black tracking-tight text-indigo-900">Work Monster</h1>
            <p className="mt-1 text-sm text-slate-500">Create your account and start the game.</p>
          </header>

          <RegisterForm />
        </section>
      </div>
    </main>
  );
}

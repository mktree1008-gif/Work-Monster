"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Chrome } from "lucide-react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { firebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { Locale, UserRole } from "@/lib/types";

type Props = {
  role: UserRole;
  locale: Locale;
};

export function GoogleLoginButton({ role, locale }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSignIn() {
    setPending(true);
    setError(null);

    try {
      let idToken = "";
      let email = "";
      let name = "";

      if (isFirebaseClientConfigured() && firebaseAuth) {
        const provider = new GoogleAuthProvider();
        const credential = await signInWithPopup(firebaseAuth, provider);
        idToken = await credential.user.getIdToken();
        email = credential.user.email ?? "";
        name = credential.user.displayName ?? "";
      } else {
        const mockEmail = window.prompt("Firebase is not configured. Enter your Google email:");
        if (!mockEmail) {
          setPending(false);
          return;
        }
        email = mockEmail;
      }

      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          email,
          name,
          role,
          locale
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Google sign-in failed.");
      }

      const payload = (await response.json()) as { redirectTo: string };
      router.push(payload.redirectTo);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google sign-in failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <button className="btn btn-muted flex w-full items-center justify-center gap-2" onClick={onSignIn} type="button">
        <Chrome size={18} />
        {pending ? (locale === "ko" ? "연결 중..." : "Connecting...") : locale === "ko" ? "Google로 시작" : "Continue with Google"}
      </button>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

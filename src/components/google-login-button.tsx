"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Chrome } from "lucide-react";
import { FirebaseError } from "firebase/app";
import { GoogleAuthProvider, getRedirectResult, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { firebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { Locale, UserRole } from "@/lib/types";

type Props = {
  role: UserRole;
  locale: Locale;
  onSuccessRedirect?: (result: { redirectTo: string; loginPointsAwarded?: boolean; loginPoints?: number }) => void;
  onError?: (message: string) => void;
};

function normalizeHost(value?: string): string {
  if (!value) return "";
  const trimmed = value.trim().toLowerCase();
  const noProtocol = trimmed.replace(/^https?:\/\//, "");
  return noProtocol.split("/")[0]?.split(":")[0] ?? "";
}

export function GoogleLoginButton({ role, locale, onSuccessRedirect, onError }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const canonicalHost = normalizeHost(process.env.NEXT_PUBLIC_APP_CANONICAL_HOST) || "workmonster.vercel.app";

  async function completeGoogleLogin(idToken: string, email: string, name: string) {
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

    const payload = (await response.json()) as {
      redirectTo: string;
      loginPointsAwarded?: boolean;
      loginPoints?: number;
    };
    if (onSuccessRedirect) {
      onSuccessRedirect(payload);
    } else {
      router.push(payload.redirectTo);
      router.refresh();
    }
  }

  useEffect(() => {
    let mounted = true;

    async function consumeRedirectResult() {
      if (!isFirebaseClientConfigured() || !firebaseAuth) return;

      try {
        const result = await getRedirectResult(firebaseAuth);
        if (!mounted || !result?.user) return;

        setPending(true);
        setError(null);
        const idToken = await result.user.getIdToken();
        const email = result.user.email ?? "";
        const name = result.user.displayName ?? "";
        await completeGoogleLogin(idToken, email, name);
      } catch (caught) {
        if (!mounted) return;
        const message = caught instanceof Error ? caught.message : "Google sign-in failed.";
        setError(message);
        onError?.(message);
      } finally {
        if (mounted) {
          setPending(false);
        }
      }
    }

    void consumeRedirectResult();
    return () => {
      mounted = false;
    };
  }, [locale, onError, onSuccessRedirect, role, router]);

  async function onSignIn() {
    setPending(true);
    setError(null);

    try {
      if (typeof window !== "undefined") {
        const currentHost = normalizeHost(window.location.hostname);
        const isLocalHost = currentHost === "localhost" || currentHost === "127.0.0.1";
        if (!isLocalHost && currentHost !== canonicalHost) {
          const target = new URL(window.location.href);
          target.protocol = "https:";
          target.hostname = canonicalHost;
          window.location.href = target.toString();
          return;
        }
      }

      let idToken = "";
      let email = "";
      let name = "";

      if (isFirebaseClientConfigured() && firebaseAuth) {
        const provider = new GoogleAuthProvider();
        try {
          const credential = await signInWithPopup(firebaseAuth, provider);
          idToken = await credential.user.getIdToken();
          email = credential.user.email ?? "";
          name = credential.user.displayName ?? "";
        } catch (caught) {
          if (
            caught instanceof FirebaseError &&
            (caught.code === "auth/popup-blocked" ||
              caught.code === "auth/popup-closed-by-user" ||
              caught.code === "auth/cancelled-popup-request" ||
              caught.code === "auth/operation-not-supported-in-this-environment")
          ) {
            await signInWithRedirect(firebaseAuth, provider);
            return;
          }
          throw caught;
        }
      } else {
        const mockEmail = window.prompt("Firebase is not configured. Enter your Google email:");
        if (!mockEmail) {
          setPending(false);
          return;
        }
        email = mockEmail;
      }

      await completeGoogleLogin(idToken, email, name);
    } catch (caught) {
      let message = caught instanceof Error ? caught.message : "Google sign-in failed.";
      if (caught instanceof FirebaseError && caught.code === "auth/unauthorized-domain") {
        const currentHost = typeof window !== "undefined" ? window.location.hostname : "unknown-host";
        message = `Google login is blocked for this domain: ${currentHost}. Add this domain in Firebase Auth > Settings > Authorized domains, or open the canonical URL.`;
      }
      setError(message);
      onError?.(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <button className="btn btn-muted flex w-full items-center justify-center gap-2" onClick={onSignIn} type="button">
        <Chrome size={18} />
        {pending ? "Connecting..." : "Continue with Google"}
      </button>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

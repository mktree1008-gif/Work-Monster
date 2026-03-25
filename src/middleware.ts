import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function normalizeHost(value?: string): string {
  if (!value) return "";
  const trimmed = value.trim().toLowerCase();
  const noProtocol = trimmed.replace(/^https?:\/\//, "");
  return noProtocol.split("/")[0]?.split(":")[0] ?? "";
}

export function middleware(request: NextRequest) {
  const host = normalizeHost(request.headers.get("host") ?? "");
  const canonicalHost =
    normalizeHost(process.env.NEXT_PUBLIC_APP_CANONICAL_HOST) ||
    normalizeHost(process.env.APP_CANONICAL_HOST) ||
    "workmonster.vercel.app";
  const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const isVercelHost = host.endsWith(".vercel.app");
  const needsCanonicalRedirect =
    Boolean(canonicalHost) && !isLocalHost && isVercelHost && host !== canonicalHost;

  if (needsCanonicalRedirect) {
    const target = request.nextUrl.clone();
    target.protocol = "https:";
    target.host = canonicalHost;
    return NextResponse.redirect(target);
  }

  const uid = request.cookies.get("wm_uid")?.value;
  const role = request.cookies.get("wm_role")?.value;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/auth/nickname") && !uid) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (pathname.startsWith("/app") && !uid) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (pathname.startsWith("/manager") && (!uid || role !== "manager")) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (pathname.startsWith("/account") && !uid) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/auth/login", "/auth/register", "/auth/nickname", "/app/:path*", "/manager/:path*", "/account/:path*"]
};

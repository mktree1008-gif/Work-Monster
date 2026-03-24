import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const uid = request.cookies.get("wm_uid")?.value;
  const role = request.cookies.get("wm_role")?.value;
  const { pathname } = request.nextUrl;

  if ((pathname.startsWith("/auth/login") || pathname.startsWith("/auth/register")) && uid) {
    const destination = role === "manager" ? "/manager" : "/app/welcome";
    return NextResponse.redirect(new URL(destination, request.url));
  }

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

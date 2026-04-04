import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

function sanitizeFileName(input: string, fallback = "attachment"): string {
  const trimmed = input.trim();
  if (!trimmed) return fallback;
  return trimmed
    .replaceAll(/[^a-zA-Z0-9._-]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 120) || fallback;
}

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1") return true;
  if (lower.endsWith(".local")) return true;
  if (/^(10\.|192\.168\.|169\.254\.)/.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true;
  return false;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Session expired. Please login again." }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url")?.trim() ?? "";
  const requestedName = request.nextUrl.searchParams.get("name")?.trim() ?? "";
  if (!url) {
    return NextResponse.json({ error: "Download URL is required." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid download URL." }, { status: 400 });
  }

  if (!(parsed.protocol === "https:" || parsed.protocol === "http:")) {
    return NextResponse.json({ error: "Unsupported URL protocol." }, { status: 400 });
  }
  if (isBlockedHost(parsed.hostname)) {
    return NextResponse.json({ error: "Blocked download host." }, { status: 400 });
  }

  const upstream = await fetch(parsed.toString(), { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Unable to download this file." }, { status: 502 });
  }

  const fallbackName = parsed.pathname.split("/").pop() || "attachment";
  const fileName = sanitizeFileName(requestedName || fallbackName);
  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const contentLength = upstream.headers.get("content-length");

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers
  });
}


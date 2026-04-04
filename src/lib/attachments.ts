export type StoredAttachmentKind = "image" | "file";

export type StoredAttachment = {
  token: string;
  name: string;
  url: string;
  kind: StoredAttachmentKind;
  contentType: string;
  size: number;
};

const ATTACHMENT_TOKEN_PREFIX = "wm_attach_v1";
const ATTACHMENT_TOKEN_SEPARATOR = "::";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function encodeStoredAttachment(input: {
  name: string;
  url: string;
  kind: StoredAttachmentKind;
  contentType?: string;
  size?: number;
}): string {
  const size = Number.isFinite(input.size) ? Math.max(0, Math.round(Number(input.size))) : 0;
  return [
    ATTACHMENT_TOKEN_PREFIX,
    encodeURIComponent(input.name.trim()),
    encodeURIComponent(input.url.trim()),
    input.kind,
    encodeURIComponent((input.contentType ?? "").trim()),
    String(size)
  ].join(ATTACHMENT_TOKEN_SEPARATOR);
}

export function decodeStoredAttachment(token: string): StoredAttachment | null {
  const trimmed = String(token ?? "").trim();
  if (!trimmed.startsWith(`${ATTACHMENT_TOKEN_PREFIX}${ATTACHMENT_TOKEN_SEPARATOR}`)) {
    return null;
  }
  const parts = trimmed.split(ATTACHMENT_TOKEN_SEPARATOR);
  if (parts.length < 4) return null;

  const name = safeDecode(parts[1] ?? "").trim();
  const url = safeDecode(parts[2] ?? "").trim();
  const kind = parts[3] === "image" ? "image" : "file";
  const contentType = safeDecode(parts[4] ?? "").trim();
  const parsedSize = Number(parts[5] ?? 0);
  const size = Number.isFinite(parsedSize) ? Math.max(0, Math.round(parsedSize)) : 0;

  if (!name || !url) return null;

  return {
    token: trimmed,
    name,
    url,
    kind,
    contentType,
    size
  };
}

export function normalizeAttachmentTokens(values: string[]): string[] {
  const next: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) continue;
    const parsed = decodeStoredAttachment(trimmed);
    const key = parsed ? `${parsed.url}::${parsed.name}` : trimmed;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(trimmed);
  }

  return next;
}

export function describeAttachment(token: string): StoredAttachment {
  const parsed = decodeStoredAttachment(token);
  if (parsed) return parsed;
  const fallbackName = String(token ?? "").trim();
  const isHttp = /^https?:\/\//i.test(fallbackName);
  const urlName = isHttp
    ? (() => {
        try {
          const parsedUrl = new URL(fallbackName);
          return parsedUrl.pathname.split("/").pop() || fallbackName;
        } catch {
          return fallbackName;
        }
      })()
    : fallbackName;
  return {
    token: fallbackName,
    name: urlName,
    url: isHttp ? fallbackName : "",
    kind: "file",
    contentType: "",
    size: 0
  };
}

export function buildAttachmentDownloadHref(url: string, name?: string): string {
  if (/^data:/i.test(url)) {
    return url;
  }
  const params = new URLSearchParams();
  params.set("url", url);
  if (name?.trim()) {
    params.set("name", name.trim());
  }
  return `/api/attachments/download?${params.toString()}`;
}

export function buildLinkDownloadHref(link: string): string {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(link)}`;
}

export function formatAttachmentSize(size: number): string {
  const safe = Number.isFinite(size) ? Math.max(0, size) : 0;
  if (safe >= 1024 * 1024) return `${(safe / (1024 * 1024)).toFixed(1)} MB`;
  if (safe >= 1024) return `${Math.round(safe / 1024)} KB`;
  return `${safe} B`;
}

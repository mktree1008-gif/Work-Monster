export function toISODate(input = new Date()): string {
  return input.toISOString().slice(0, 10);
}

export function isISODateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function toISODateInTimeZone(timeZone: string, input = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(input);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to resolve date for timezone.");
  }

  return `${year}-${month}-${day}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(`${aISO}T00:00:00.000Z`);
  const b = new Date(`${bISO}T00:00:00.000Z`);
  const diff = Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function formatDateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(iso));
}

let localCounter = 0;
export function createId(prefix: string): string {
  localCounter += 1;
  return `${prefix}_${Date.now()}_${localCounter}`;
}

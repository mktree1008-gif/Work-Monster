export function toISODate(input = new Date()): string {
  return input.toISOString().slice(0, 10);
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

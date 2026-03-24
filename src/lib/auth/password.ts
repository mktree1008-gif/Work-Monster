import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const calculated = scryptSync(password, salt, KEY_LENGTH);
  const stored = Buffer.from(hash, "hex");
  if (stored.length !== calculated.length) {
    return false;
  }
  return timingSafeEqual(stored, calculated);
}

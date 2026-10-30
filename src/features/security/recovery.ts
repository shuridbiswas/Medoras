import { createHash, randomInt } from "node:crypto";

/** No 0/o/1/l/i so a code read off a printout is hard to mistype. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export const RECOVERY_CODE_COUNT = 10;
const GROUPS = 3;
const GROUP_LENGTH = 4;

/** "xxxx-xxxx-xxxx": about 59 bits each, from a cryptographically secure source. */
export function generateRecoveryCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = "";
    for (let i = 0; i < GROUP_LENGTH; i++) group += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(group);
  }
  return groups.join("-");
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(generateRecoveryCode());
  return [...codes];
}

/** Matches the normalisation in redeem_mfa_recovery_code: lower case, letters and digits only. */
export function normalizeRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[^0-9a-z]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(code), "utf8").digest("hex");
}

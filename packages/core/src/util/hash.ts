import crypto from "crypto";

const _sha256 = crypto.createHash("sha256");

/**
 * Returns the sha256 hash of the given string as hexadecimal.
 */
export function sha256(s: string): string {
  return _sha256.update(s).digest("hex");
}

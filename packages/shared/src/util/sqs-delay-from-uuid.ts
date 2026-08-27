import { createHash } from "node:crypto";

/** SQS max delivery delay is 15 minutes (900 seconds). Delay must not exceed this. */
export const SQS_MAX_DELAY_SECONDS = 900;

/**
 * Maps a string (e.g. cxId or UUID v4) to a delivery delay in seconds for SQS,
 * evenly distributed across 0 to 15 minutes (max). Same input always gets the same delay (deterministic).
 *
 * @param id - Any string identifier (e.g. cxId, UUID v4)
 * @returns Delay in seconds in [0, 900] (≤ 15 min, SQS max)
 */
export function uuidToDelaySeconds(
  id: string,
  maxDelaySeconds: number = SQS_MAX_DELAY_SECONDS
): number {
  const BUCKET_COUNT = maxDelaySeconds + 1; // maxDelaySeconds + 1 → 0..maxDelaySeconds
  const hash = createHash("sha256").update(id, "utf8").digest();
  const value = hash.readUInt32BE(0) * 0x100000000 + hash.readUInt32BE(4);
  return value % BUCKET_COUNT; // always in [0, maxDelaySeconds]
}

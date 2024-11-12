import { z } from "zod";

export const oneMinuteInMs = 60000;
export const rateLimitPartitionKey = "cxIdAndOperationAndWindow";
export const rateLimitLimitKey = "windowLimit";

export type RateLimitWindow = typeof oneMinuteInMs;
export type RateLimitOperation = "patientQuery" | "documentQuery" | "consolidatedDataQuery";

export const rateLimitLimitSchema = z.object({
  [rateLimitPartitionKey]: z.string(),
  [rateLimitLimitKey]: z.number(),
});

export const rateLimitCountSchema = z.object({
  [rateLimitPartitionKey]: z.string(),
  totalHits: z.number(), // https://express-rate-limit.mintlify.app/guides/creating-a-store
  resetTime: z.number(), // https://express-rate-limit.mintlify.app/guides/creating-a-store
});

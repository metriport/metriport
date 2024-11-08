import { z } from "zod";

export type RateLimitOperation = "patientQuery" | "documentQuery" | "consolidatedDataQuery";

export type RateLimit = "operationsPerMinute";

export const rateLimitEntrySchema = z.object({
  cxId_operation: z.string(),
  operationsPerMinute: z.number(),
});

const trackingEntrSchame = z.object({
  cxId_operation: z.string(),
  numberOfOperation: z.number(),
  window_timestamp: z.string(),
});

export const trackingEntriesSchema = trackingEntrSchame.array();

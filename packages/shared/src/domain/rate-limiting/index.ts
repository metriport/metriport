import { z } from "zod";

export type RateLimitOperation = "patientQuery" | "documentQuery" | "consolidatedDataQuery";

export type RateLimit = "operationsPerMinute";

export const rateLimitEntrySchema = z.object({
  cxIdAndOperation: z.string(),
  operationsPerMinute: z.number(),
});

const trackingEntrySchema = z.object({
  cxIdAndOperation: z.string(),
  numberOfOperation: z.number(),
  windowTimestamp: z.string(),
});

export const trackingEntriesSchema = trackingEntrySchema.array();

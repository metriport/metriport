import { z } from "zod";

export type RateLimitOperation = "patientCreate";

export type RateLimit = "operationsPerMinute";

export const rateLimitEntrySchema = z.object({
  operationsPerMinute: z.object({
    N: z.string(),
  }),
});

const trackingEntrSchame = z.object({
  count: z.object({
    N: z.string(),
  }),
});

export const trackingEntriesSchema = trackingEntrSchame.array();

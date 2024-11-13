import { z } from "zod";

export const oneMinuteInMs = 60000;
export const rateLimitPartitionKey = "cxIdAndOperationAndWindow";
export const rateLimitLimitKey = "windowLimit";

export type RateLimitWindow = typeof oneMinuteInMs;
export type RateLimitOperation = "patientQuery" | "documentQuery" | "consolidatedDataQuery";

export const rateLimitWindows = [oneMinuteInMs] as RateLimitWindow[];
export const rateLimitOperations = [
  "patientQuery",
  "documentQuery",
  "consolidatedDataQuery",
] as RateLimitOperation[];

export const rateLimitLimitSchema = z.object({
  [rateLimitPartitionKey]: z.string(),
  [rateLimitLimitKey]: z.number(),
});

export const rateLimitCountSchema = z.object({
  [rateLimitPartitionKey]: z.string(),
  totalHits: z.number(), // https://express-rate-limit.mintlify.app/guides/creating-a-store
  resetTime: z.number().optional(), // https://express-rate-limit.mintlify.app/guides/creating-a-store
});

export const routeMapForError: Record<RateLimitOperation, string> = {
  patientQuery: "Too many patient creates or updates, please try again later.",
  documentQuery: "Too many patient documeny query starts, please try again later.",
  consolidatedDataQuery: "Too many patient consolidated data query starts, please try again later.",
};

export const defaultOperationLimits: {
  [k in RateLimitOperation]: { [k in RateLimitWindow]: number };
} = {
  patientQuery: {
    [oneMinuteInMs]: 10,
  },
  documentQuery: {
    [oneMinuteInMs]: 10,
  },
  consolidatedDataQuery: {
    [oneMinuteInMs]: 100,
  },
};

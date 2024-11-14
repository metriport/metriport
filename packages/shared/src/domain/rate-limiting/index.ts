import { z } from "zod";
import dayjs from "dayjs";

export const globalWindow = dayjs.duration(60000, "milliseconds");
export const rateLimitPartitionKey = "cxIdAndOperationAndWindow";
export const rateLimitThresholdKey = "limitThreshold";

export type RateLimitWindow = typeof globalWindow;
export type RateLimitOperation = "patientQuery" | "documentQuery" | "consolidatedDataQuery";

export const rateLimitOperations = [
  "patientQuery",
  "documentQuery",
  "consolidatedDataQuery",
] as RateLimitOperation[];

export const rateLimitThresholdSchema = z.object({
  [rateLimitPartitionKey]: z.string(),
  [rateLimitThresholdKey]: z.number(),
});

export const rateLimitCountSchema = z.object({
  [rateLimitPartitionKey]: z.string(),
  totalHits: z.number(), // https://express-rate-limit.mintlify.app/guides/creating-a-store
  resetTime: z.number().optional(), // https://express-rate-limit.mintlify.app/guides/creating-a-store
});

export const routeMapForError: Record<RateLimitOperation, string> = {
  patientQuery: "Too many patient creates or updates, please try again later.",
  documentQuery: "Too many patient document query starts, please try again later.",
  consolidatedDataQuery: "Too many patient consolidated data query starts, please try again later.",
};

export const defaultOperationLimits: {
  [k in RateLimitOperation]: number;
} = {
  patientQuery: 10,
  documentQuery: 10,
  consolidatedDataQuery: 100,
};

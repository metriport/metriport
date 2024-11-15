import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { z } from "zod";
import { MetriportError } from "../../error/metriport-error";

dayjs.extend(duration);

export const globalWindow = dayjs.duration(1, "minute");
export const rateLimitPartitionKey = "cxIdAndOperationAndWindow";
export const rateLimitThresholdKey = "limitThreshold";

export type RateLimitWindow = typeof globalWindow;
export type RateLimitOperation =
  | "patientCreateOrUpdate"
  | "documentQuery"
  | "consolidatedDataQuery";

export const rateLimitOperations = [
  "patientCreateOrUpdate",
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

export const errorMessageByOperation: Record<RateLimitOperation, string> = {
  patientCreateOrUpdate: "Too many patient creates or updates, please try again later.",
  documentQuery: "Too many patient document query starts, please try again later.",
  consolidatedDataQuery: "Too many patient consolidated data query starts, please try again later.",
};

export function getDefaultLimit(operation: RateLimitOperation): number {
  const limit = defaultOperationLimits[operation];
  if (!limit) throw new MetriportError("Rate limit threshold not found", undefined, { operation });
  return limit;
}

const defaultOperationLimits: {
  [k in RateLimitOperation]: number;
} = {
  patientCreateOrUpdate: 10,
  documentQuery: 10,
  consolidatedDataQuery: 100,
};

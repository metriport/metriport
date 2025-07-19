import { z } from "zod";

export type JobParamsCx = Record<string, string | boolean>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JobParamsOps = Record<string, any>;

const failed = "failed" as const;
const successful = "successful" as const;
export type JobEntryStatus = typeof failed | typeof successful;

export function isValidJobEntryStatus(status: string): status is JobEntryStatus {
  return status === "failed" || status === "successful";
}

export const jobRunBodySchema = z.object({
  cxId: z.string(),
  jobId: z.string(),
});

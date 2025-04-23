import { JobStatus } from "./job-status";

export type JobParamsCx = Record<string, string | boolean>;
export type JobParamsOps = Record<string, string | boolean>;

const failed = "failed" as const;
const successful = "successful" as const;

export type JobEntryStatusFailed = typeof failed;
export type JobEntryStatusParsed = "waiting" | "processing" | typeof successful;
export type JobEntryStatus = JobEntryStatusFailed | JobEntryStatusParsed;
export type JobEntryStatusFinal = typeof failed | typeof successful;

export function isValidJobEntryStatus(status: string): status is JobEntryStatus {
  return (
    status === "waiting" ||
    status === "processing" ||
    status === "successful" ||
    status === "failed"
  );
}

export function isValidJobStatus(status: string): status is JobStatus {
  return status === "waiting" || status === "processing" || status === "completed";
}

import { JobStatus } from "./job-status";
import { JobParamsCx, JobParamsOps } from "./types";

export type PatientJob = {
  id: string;
  cxId: string;
  patientId: string;
  jobType: string;
  jobGroupId: string;
  requestId?: string;
  status: JobStatus;
  statusReason: string | undefined;
  scheduledAt: Date | undefined;
  startedAt: Date | undefined;
  finishedAt: Date | undefined;
  cancelledAt: Date | undefined;
  failedAt: Date | undefined;
  total: number;
  successful: number;
  failed: number;
  paramsCx: JobParamsCx | undefined;
  paramsOps: JobParamsOps | undefined;
  data: unknown;
  runtimeData: unknown;
  createdAt: Date;
};

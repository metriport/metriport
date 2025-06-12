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

/**
 * Used by code that needs to access the raw data from the database.
 * @see updatePatientJobTotals()
 */
export const patientJobRawColumnNames = {
  id: "id",
  cxId: "cx_id",
  patientId: "patient_id",
  jobType: "job_type",
  jobGroupId: "job_group_id",
  requestId: "request_id",
  status: "status",
  statusReason: "status_reason",
  scheduledAt: "scheduled_at",
  startedAt: "started_at",
  finishedAt: "finished_at",
  cancelledAt: "cancelled_at",
  failedAt: "failed_at",
  total: "total",
  successful: "successful",
  failed: "failed",
  paramsCx: "params_cx",
  paramsOps: "params_ops",
  data: "data",
  runtimeData: "runtime_data",
};

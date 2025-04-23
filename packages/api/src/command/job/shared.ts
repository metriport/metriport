import { JobEntryStatus, JobStatus } from "@metriport/shared";

export type GetJobByIdParams = {
  cxId: string;
  jobId: string;
};

export type UpdateJobTotalsParams = {
  jobId: string;
  cxId: string;
  entryStatus: JobEntryStatus;
  onCompleted?: () => Promise<void>;
};

export type UpdateJobTotalsResponse = {
  jobId: string;
  cxId: string;
  status: JobStatus;
  successful: number;
  failed: number;
  total: number;
};

export type UpdateJobTrackingParams = {
  jobId: string;
  cxId: string;
  status?: JobStatus;
  total?: number;
  forceStatusUpdate?: boolean;
  onCompleted?: () => Promise<void>;
};

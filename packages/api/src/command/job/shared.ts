import { JobEntryStatus, JobStatus } from "@metriport/shared";

export type GetJobByIdParams = {
  cxId: string;
  jobId: string;
};

export type UpdateJobCountParams = {
  jobId: string;
  cxId: string;
  entryStatus: JobEntryStatus;
  onCompleted?: () => Promise<void>;
};

export type UpdateJobCountResponse = {
  jobId: string;
  cxId: string;
  status: JobStatus;
  successful: number;
  failed: number;
  total: number;
};

export type InitializeJobParams = {
  jobId: string;
  cxId: string;
  forceStatusUpdate?: boolean;
};

export type UpdateJobTotalParams = {
  jobId: string;
  cxId: string;
  total: number;
  forceTotalUpdate?: boolean;
};

export type FailJobParams = {
  jobId: string;
  cxId: string;
  reason: string;
  forceStatusUpdate?: boolean;
};

export type FinishJobParams = {
  jobId: string;
  cxId: string;
  forceStatusUpdate?: boolean;
  onCompleted?: () => Promise<void>;
};

import { PatientImportJobStatus } from "./status";

export type GetPatientImport = {
  id: string;
  cxId: string;
};

export type PatientImportParamsCx = {
  dryRun: boolean;
};

export type PatientImportParamsOps = {
  dryRun?: boolean | undefined;
  rerunPdOnNewDemographics: boolean;
  triggerConsolidated: boolean;
  disableWebhooks: boolean;
};

// TODO 2330 move BaseDomain to packages/shared and extend from it here
export type PatientImportJob = {
  id: string;
  cxId: string;
  facilityId: string;
  status: PatientImportJobStatus;
  reason: string | undefined;
  /** When the job was created, when the jobId was generated. */
  createdAt: Date;
  /** When the job was actually started, after parsing and patient creates started to be sent to the queue for processing. */
  startedAt: Date | undefined;
  /** When the job was finished, when the last data pipeline of the last patient was completed. */
  finishedAt: Date | undefined;
  total: number;
  successful: number;
  failed: number;
  paramsCx: PatientImportParamsCx;
  paramsOps: PatientImportParamsOps;
};

const failed = "failed" as const;
const successful = "successful" as const;

export type PatientImportEntryStatusFailed = typeof failed;
export type PatientImportEntryStatusParsed = "waiting" | "processing" | typeof successful;
export type PatientImportEntryStatus =
  | PatientImportEntryStatusFailed
  | PatientImportEntryStatusParsed;
export const finalStatuses = [failed, successful];
export type PatientImportEntryStatusFinal = (typeof finalStatuses)[number];

export function isDryRun(job: Pick<PatientImportJob, "paramsCx" | "paramsOps">): boolean {
  return job.paramsOps?.dryRun ?? job.paramsCx?.dryRun ?? false;
}

export function isPatientImportEntryStatusFinal(
  status: PatientImportEntryStatus
): status is PatientImportEntryStatusFinal {
  return finalStatuses.includes(status as PatientImportEntryStatusFinal);
}

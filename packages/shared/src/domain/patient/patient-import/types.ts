import { PatientImportStatus } from "./status";

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
export type PatientImport = {
  id: string;
  cxId: string;
  facilityId: string;
  status: PatientImportStatus;
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
export type PatientImportEntryStatusFinal = typeof failed | typeof successful;

export function isDryRun(job: Pick<PatientImport, "paramsCx" | "paramsOps">): boolean {
  return job.paramsOps?.dryRun ?? job.paramsCx?.dryRun ?? false;
}

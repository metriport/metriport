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
  total: number | undefined;
  successful: number | undefined;
  failed: number | undefined;
  paramsCx: PatientImportParamsCx;
  paramsOps: PatientImportParamsOps;
};

export type PatientImportEntryStatusFailed = "failed";
export type PatientImportEntryStatusParsed = "waiting" | "processing" | "successful";
export type PatientImportEntryStatus =
  | PatientImportEntryStatusFailed
  | PatientImportEntryStatusParsed;

const isDevKey = "isDev";

/**
 * Used to store metadata on the upload URL.
 */
export type PatientImportUploadMetadata = {
  [isDevKey]?: boolean;
};

export function metaToRecord(
  metadata: PatientImportUploadMetadata
): Record<keyof PatientImportUploadMetadata, string> {
  return {
    [isDevKey]: metadata[isDevKey] ? "true" : "false",
  };
}

export function recordToMeta(record: Record<string, string>): PatientImportUploadMetadata {
  return {
    ...(record[isDevKey] ? { [isDevKey]: record[isDevKey] === "true" } : {}),
  };
}

export function isPatientImportRunningOnDev(
  metadata: PatientImportUploadMetadata | undefined
): boolean {
  const isDevProp = metadata?.[isDevKey];
  return isDevProp ? [true, "true"].includes(isDevProp) : false;
}

export function isDryRun(job: Pick<PatientImport, "paramsCx" | "paramsOps">): boolean {
  return job.paramsOps?.dryRun ?? job.paramsCx?.dryRun ?? false;
}

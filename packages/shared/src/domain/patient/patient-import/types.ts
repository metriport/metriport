// TODO 2330 add expired
export const patientImportStatus = ["waiting", "processing", "completed", "failed"] as const;
// export const patientImportStatus = [
//   "waiting",
//   "processing",
//   "completed",
//   "failed",
//   "expired",
// ] as const;
export type PatientImportStatus = (typeof patientImportStatus)[number];

export type GetPatientImport = {
  id: string;
  cxId: string;
};

export type PatientImportParams = {
  dryRun: boolean;
  rerunPdOnNewDemographics: boolean;
  triggerConsolidated: boolean;
  disableWebhooks: boolean;
};

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
  params: PatientImportParams;
};

export type PatientImportEntryStatusFailed = "failed";
export type PatientImportEntryStatusParsed = "waiting" | "processing" | "successful";
export type PatientImportEntryStatus =
  | PatientImportEntryStatusFailed
  | PatientImportEntryStatusParsed;

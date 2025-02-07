import { PatientImportStatus } from "@metriport/core/domain/patient/patient-import";

export type PatientImportParamsDto = {
  facilityId: string;
  dryRun: boolean;
};

export type PatientImportDto = {
  jobId: string;
  status: PatientImportStatus;
  params: PatientImportParamsDto;
  uploadUrl: string;
};

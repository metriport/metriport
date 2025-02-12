import { PatientImportStatus } from "@metriport/core/domain/patient/patient-import";

export type PatientImportParamsDto = {
  dryRun: boolean;
};

export type PatientImportDto = {
  requestId: string;
  facilityId: string;
  status: PatientImportStatus;
  uploadUrl: string;
  params: PatientImportParamsDto;
};

import { PatientImportStatus } from "@metriport/shared/domain/patient/patient-import/types";

export type PatientImportParamsDto = {
  dryRun: boolean;
};

export type PatientImportDto = {
  requestId: string;
  facilityId: string;
  status: PatientImportStatus;
  uploadUrl: string;
  params: PatientImportParamsDto;
  createdAt: string;
};

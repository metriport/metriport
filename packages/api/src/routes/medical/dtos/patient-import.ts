import { PatientImportStatus } from "@metriport/shared/domain/patient/patient-import/status";
import { PatientImportCreateResponse } from "../../../command/medical/patient/patient-import/create";

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

export function fromCreateResponseToDto(domain: PatientImportCreateResponse): PatientImportDto {
  const { id: jobId, facilityId, status, paramsCx, createdAt, uploadUrl } = domain;
  const { dryRun } = paramsCx;

  const dto = {
    requestId: jobId,
    facilityId,
    status,
    uploadUrl,
    params: { dryRun: dryRun ?? false },
    createdAt: createdAt.toISOString(),
  };
  return dto;
}

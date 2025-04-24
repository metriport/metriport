import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  PatientImportMapping,
  PatientImportMappingCreate,
} from "@metriport/shared/domain/patient/patient-import/mapping";
import { PatientImportMappingModel } from "../../../../../models/medical/patient-import-mapping";

export type CreatePatientImportMappingCmd = Omit<
  PatientImportMapping,
  "id" | "createdAt" | "updatedAt"
>;

export async function createPatientImportMapping({
  cxId,
  jobId,
  rowNumber,
  patientId,
  dataPipelineRequestId,
}: CreatePatientImportMappingCmd): Promise<PatientImportMapping> {
  const mappingToCreate: PatientImportMappingCreate = {
    id: uuidv7(),
    cxId,
    jobId,
    rowNumber,
    patientId,
    dataPipelineRequestId,
  };
  const newMapping = await PatientImportMappingModel.create(mappingToCreate);
  return newMapping.dataValues;
}

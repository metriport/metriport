import { PatientImportMapping } from "@metriport/shared/domain/patient/patient-import/mapping";
import { PatientImportMappingModel } from "../../../../../models/medical/patient-import-mapping";

export type GetPatientImportMappingCmd = {
  cxId: string;
  patientId: string;
  requestId: string;
};

export async function getPatientImportMappings({
  cxId,
  patientId,
  requestId,
}: GetPatientImportMappingCmd): Promise<PatientImportMapping[]> {
  const mappings = await PatientImportMappingModel.findAll({
    where: {
      cxId,
      patientId,
      requestId,
    },
  });
  return mappings.map(m => m.dataValues);
}

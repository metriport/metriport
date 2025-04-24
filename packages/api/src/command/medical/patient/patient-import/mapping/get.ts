import { MetriportError } from "@metriport/shared";
import { PatientImportMapping } from "@metriport/shared/domain/patient/patient-import/mapping";
import { PatientImportMappingModel } from "../../../../../models/medical/patient-import-mapping";

export type GetPatientImportMappingCmd = {
  cxId: string;
  patientId: string;
  dataPipelineRequestId: string;
};

export async function getPatientImportMappings({
  cxId,
  patientId,
  dataPipelineRequestId,
}: GetPatientImportMappingCmd): Promise<PatientImportMapping[]> {
  const mappings = await PatientImportMappingModel.findAll({
    where: {
      cxId,
      patientId,
      dataPipelineRequestId,
    },
  });
  return mappings.map(m => m.dataValues);
}

export async function getSinglePatientImportMapping({
  cxId,
  patientId,
  dataPipelineRequestId,
}: GetPatientImportMappingCmd): Promise<PatientImportMapping | undefined> {
  const mappings = await getPatientImportMappings({ cxId, patientId, dataPipelineRequestId });

  if (mappings.length > 1) {
    const mappingIds = mappings.map(m => m.jobId);
    throw new MetriportError(`Multiple patient import mappings found`, undefined, {
      cxId,
      patientId,
      dataPipelineRequestId,
      mappingIds: mappingIds.join(", "),
    });
  }

  return mappings[0];
}

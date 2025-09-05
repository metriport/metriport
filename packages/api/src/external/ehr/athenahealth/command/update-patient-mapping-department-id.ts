import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { setSecondaryMappingsOnPatientMappingById } from "../../../../command/mapping/patient";
import { getPatientMappingAndParsedSecondaryMappings } from "../../shared/command/mapping/get-patient-mapping-and-secondary-mappings";

export type UpdateAthenaPatientMappingDepartmentIdParams = {
  cxId: string;
  athenaPatientId: string;
  athenaDepartmentId: string;
};

/**
 * Updates the department ID for an Athena patient mapping secondary mapping.
 * This command updates the departmentId field in the secondary mappings
 * while preserving other existing secondary mapping data.
 */
export async function updateAthenaPatientMappingDepartmentId({
  cxId,
  athenaPatientId,
  athenaDepartmentId,
}: UpdateAthenaPatientMappingDepartmentIdParams): Promise<void> {
  const { parsedSecondaryMappings, patientMapping } =
    await getPatientMappingAndParsedSecondaryMappings({
      ehr: EhrSources.athena,
      cxId,
      ehrPatientId: athenaPatientId,
    });
  if (parsedSecondaryMappings.departmentId === athenaDepartmentId) return;
  await setSecondaryMappingsOnPatientMappingById({
    cxId,
    patientId: patientMapping.patientId,
    id: patientMapping.id,
    secondaryMappings: {
      ...parsedSecondaryMappings,
      departmentId: athenaDepartmentId,
    },
  });
}

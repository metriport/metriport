import { EhrSources, JwtTokenInfo } from "@metriport/shared";
import { athenaPatientMappingSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/athenahealth/patient-mapping";
import { getPatientSecondaryMappings } from "../../api/get-patient-secondary-mappings";
import { updateAthenaPatientSecondaryMappingDepartmentId } from "../api/update-secondary-mapping-department-id";
import { createAthenaHealthClient } from "../shared";

export type GetPatientDepartmentIdParams = {
  tokenInfo?: JwtTokenInfo;
  cxId: string;
  patientId: string;
  practiceId: string;
};

/**
 * Fetches the department ID from API or Athena, and updates the secondary mappings if not found in the API
 */
export async function getPatientDepartmentId({
  tokenInfo,
  cxId,
  patientId,
  practiceId,
}: GetPatientDepartmentIdParams): Promise<string> {
  const existingSecondaryMappings = await getPatientSecondaryMappings({
    ehr: EhrSources.athena,
    cxId,
    patientId,
    schema: athenaPatientMappingSecondaryMappingsSchema,
  });
  if (existingSecondaryMappings.departmentId) return existingSecondaryMappings.departmentId;
  const client = await createAthenaHealthClient({
    cxId,
    practiceId,
    ...(tokenInfo ? { tokenInfo } : {}),
  });
  const departmentId = await client.getDepartmentIdForPatient({ cxId, patientId });
  await updateAthenaPatientSecondaryMappingDepartmentId({
    cxId,
    patientId,
    departmentId,
  });
  return departmentId;
}

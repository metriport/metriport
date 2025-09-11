import { BadRequestError, JwtTokenInfo } from "@metriport/shared";
import { athenaSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getSecondaryMappings } from "../../api/get-secondary-mappings";
import { getPatientDepartmentId } from "./get-patient-department-id";

export async function getAndCheckAthenaPatientDepartmentId({
  cxId,
  practiceId,
  patientId,
  tokenInfo,
}: {
  cxId: string;
  practiceId: string;
  patientId: string;
  tokenInfo?: JwtTokenInfo;
}) {
  const [departmentId, secondaryMappings] = await Promise.all([
    getPatientDepartmentId({
      cxId,
      patientId,
      practiceId,
      ...(tokenInfo ? { tokenInfo } : {}),
    }),
    getSecondaryMappings({
      ehr: EhrSources.athena,
      practiceId,
      schema: athenaSecondaryMappingsSchema,
    }),
  ]);
  if (
    secondaryMappings.departmentIds.length > 0 &&
    !secondaryMappings.departmentIds.includes(departmentId)
  ) {
    throw new BadRequestError(
      "AthenaHealth patient is not in a department that is enabled",
      undefined,
      {
        ehr: EhrSources.athena,
        practiceId,
        patientId,
        departmentId,
      }
    );
  }
  return departmentId;
}

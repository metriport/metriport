import { BadRequestError } from "@metriport/shared";
import { athenaSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getSecondaryMappings } from "../../../api/get-secondary-mappings";
import { WriteBackConditionClientRequest } from "../../../command/write-back/condition";
import { createAthenaHealthClient } from "../../shared";

export async function writeBackCondition(params: WriteBackConditionClientRequest): Promise<void> {
  const { cxId, practiceId, ehrPatientId, tokenId, condition } = params;
  const secondaryMappings = await getSecondaryMappings({
    ehr: EhrSources.athena,
    practiceId,
    schema: athenaSecondaryMappingsSchema,
  });
  const athenaDepartmentId = secondaryMappings.departmentIds[0];
  if (!athenaDepartmentId) {
    throw new BadRequestError("Department ID not found", undefined, {
      ehr: EhrSources.athena,
      practiceId,
    });
  }
  const client = await createAthenaHealthClient({
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  await client.createProblem({
    cxId,
    patientId: ehrPatientId,
    departmentId: athenaDepartmentId,
    condition,
  });
}

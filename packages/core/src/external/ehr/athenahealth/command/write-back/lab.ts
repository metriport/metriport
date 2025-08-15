import { BadRequestError } from "@metriport/shared";
import { athenaSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getSecondaryMappings } from "../../../api/get-secondary-mappings";
import { WriteBackLabClientRequest } from "../../../command/write-back/lab";
import { createAthenaHealthClient } from "../../shared";

export async function writeBackLab(params: WriteBackLabClientRequest): Promise<void> {
  const { cxId, practiceId, ehrPatientId, tokenId, observation } = params;
  const secondaryMappings = await getSecondaryMappings({
    ehr: EhrSources.athena,
    practiceId,
    schema: athenaSecondaryMappingsSchema,
  });
  const athenaDepartmentIds = secondaryMappings.departmentIds;
  if (!athenaDepartmentIds || athenaDepartmentIds.length === 0) {
    throw new BadRequestError("Department IDs not found", undefined, {
      ehr: EhrSources.athena,
      practiceId,
    });
  }

  // Use the first department ID for write-back
  const athenaDepartmentId = athenaDepartmentIds[0];
  if (!athenaDepartmentId) {
    throw new BadRequestError("First department ID not found", undefined, {
      ehr: EhrSources.athena,
      practiceId,
    });
  }

  const client = await createAthenaHealthClient({
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  await client.createLabResultDocument({
    cxId,
    patientId: ehrPatientId,
    departmentId: athenaDepartmentId,
    observation,
  });
}

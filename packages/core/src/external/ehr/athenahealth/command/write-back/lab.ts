import { BadRequestError } from "@metriport/shared";
import { athenaSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getSecondaryMappings } from "../../../api/get-secondary-mappings";
import { WriteBackLabClientRequest } from "../../../command/write-back/lab";
import { createAthenaHealthClient } from "../../shared";

export async function writeBackLab(params: WriteBackLabClientRequest): Promise<void> {
  const { cxId, practiceId, ehrPatientId, tokenInfo, observation } = params;

  // TODO: rework
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
    ...(tokenInfo ? { tokenInfo } : {}),
  });
  await client.createLabResultDocument({
    cxId,
    patientId: ehrPatientId,
    departmentId: athenaDepartmentId,
    observation,
  });
}

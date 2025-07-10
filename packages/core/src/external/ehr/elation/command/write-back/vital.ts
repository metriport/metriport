import { BadRequestError } from "@metriport/shared";
import { elationSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/elation/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getSecondaryMappings } from "../../../api/get-secondary-mappings";
import { WriteBackVitalClientRequest } from "../../../command/write-back/vital";
import { createElationHealthClient } from "../../shared";

export async function writeBackVital(params: WriteBackVitalClientRequest): Promise<void> {
  const { cxId, practiceId, ehrPatientId, tokenId, observation } = params;
  const secondaryMappings = await getSecondaryMappings({
    ehr: EhrSources.elation,
    practiceId,
    schema: elationSecondaryMappingsSchema,
  });
  const elationPracticeId = secondaryMappings.defaultPracticeId;
  const elationPhysicianId = secondaryMappings.defaultPhysicianId;
  if (!elationPracticeId || !elationPhysicianId) {
    throw new BadRequestError("Default practice or physician not found", undefined, {
      ehr: EhrSources.elation,
      practiceId,
    });
  }
  const client = await createElationHealthClient({
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  await client.createVital({
    cxId,
    elationPracticeId,
    elationPhysicianId,
    patientId: ehrPatientId,
    observation,
  });
}

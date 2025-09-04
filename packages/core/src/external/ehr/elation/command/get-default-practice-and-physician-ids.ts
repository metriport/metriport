import { BadRequestError } from "@metriport/shared";
import { elationSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/elation/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getSecondaryMappings } from "../../api/get-secondary-mappings";

export async function getDefaultPracticeAndPhysicianIds({
  practiceId,
}: {
  practiceId: string;
}): Promise<{ elationPracticeId: string; elationPhysicianId: string }> {
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
  return { elationPracticeId, elationPhysicianId };
}

import {
  EhrCxMappingSecondaryMappings,
  ehrCxMappingSecondaryMappingsSchemaMap,
  EhrSourceWithSecondaryMappings,
} from "@metriport/core/src/external/ehr/mappings";
import { MetriportError } from "@metriport/shared";
import { getCxMappingOrFail } from "../../../../../command/mapping/cx";
import { CxMapping } from "../../../../../domain/cx-mapping";

/**
 * Get the cx mapping and parsed secondary mappings for a given practice ID for all EHRs
 *
 * @param ehr - The EHR source.
 * @param practiceId - The practice id of the EHR integration.
 * @returns The secondary mappings for the practice or null if the EHR doesn't have secondary mappings.
 */
export async function getCxMappingAndParsedSecondaryMappings<
  T extends EhrCxMappingSecondaryMappings
>({
  ehr,
  practiceId,
}: {
  ehr: EhrSourceWithSecondaryMappings;
  practiceId: string;
}): Promise<{ parsedSecondaryMappings: T; cxMapping: CxMapping }> {
  const cxMappingLookupParams = { externalId: practiceId, source: ehr };
  const cxMapping = await getCxMappingOrFail(cxMappingLookupParams);
  if (!cxMapping.secondaryMappings) {
    throw new MetriportError("Secondary mappings not found", undefined, {
      externalId: practiceId,
      source: ehr,
    });
  }
  const schema = ehrCxMappingSecondaryMappingsSchemaMap[ehr];
  return {
    parsedSecondaryMappings: schema.parse(cxMapping.secondaryMappings) as T,
    cxMapping,
  };
}

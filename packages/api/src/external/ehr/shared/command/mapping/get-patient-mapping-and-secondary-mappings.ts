import {
  EhrPatientMappingSecondaryMappings,
  EhrSourceWithSecondaryMappings,
  ehrPatientMappingSecondaryMappingsSchemaMap,
} from "@metriport/core/external/ehr/mappings";
import { MetriportError } from "@metriport/shared";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { PatientMapping } from "../../../../../domain/patient-mapping";

/**
 * Get the patient mapping and parsed secondary mappings for a given practice ID for all EHRs
 *
 * @param cxId - The ID of the Metriport Customer.
 * @param ehr - The EHR source.
 * @param ehrPatientId - The practice id of the EHR integration.
 * @returns The patient mapping and parsed secondary mappings for the practice.
 */
export async function getPatientMappingAndParsedSecondaryMappings<
  T extends EhrPatientMappingSecondaryMappings
>({
  cxId,
  ehr,
  ehrPatientId,
}: {
  cxId: string;
  ehr: EhrSourceWithSecondaryMappings;
  ehrPatientId: string;
}): Promise<{ parsedSecondaryMappings: T; patientMapping: PatientMapping }> {
  const patientMappingLookupParams = { cxId, externalId: ehrPatientId, source: ehr };
  const patientMapping = await getPatientMappingOrFail(patientMappingLookupParams);
  if (!patientMapping.secondaryMappings) {
    throw new MetriportError("Secondary mappings not found", undefined, {
      cxId,
      externalId: ehrPatientId,
      source: ehr,
    });
  }
  const schema = ehrPatientMappingSecondaryMappingsSchemaMap[ehr];
  return {
    parsedSecondaryMappings: schema.parse(patientMapping.secondaryMappings) as T,
    patientMapping,
  };
}

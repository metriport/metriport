import { Bundle } from "@medplum/fhirtypes";
import { athenaSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getSecondaryMappings } from "../../api/get-secondary-mappings";
import { GetBundleByResourceTypeClientRequest } from "../../command/get-bundle-by-resource-type";
import { createAthenaHealthClient } from "../shared";

export async function getBundleByResourceType(
  params: GetBundleByResourceTypeClientRequest
): Promise<Bundle> {
  const {
    tokenId,
    cxId,
    practiceId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    useCachedBundle,
  } = params;
  const client = await createAthenaHealthClient({
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  const mappings = await getSecondaryMappings({
    ehr: EhrSources.athena,
    practiceId,
    schema: athenaSecondaryMappingsSchema,
  });
  const bundle = await client.getBundleByResourceType({
    cxId,
    metriportPatientId,
    athenaPatientId: ehrPatientId,
    resourceType,
    useCachedBundle,
    ...(mappings?.contributionEncounterAppointmentTypesBlacklist && {
      attachAppointmentType: true,
    }),
    ...(mappings?.contributionEncounterSummariesEnabled && {
      fetchEncounterSummary: true,
    }),
  });
  return bundle;
}

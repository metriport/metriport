import { Bundle } from "@medplum/fhirtypes";
import { athenaSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getSecondaryMappings } from "../../api/get-secondary-mappings";
import { GetResourceBundleByResourceIdClientRequest } from "../../command/get-resource-bundle-by-resource-id";
import { createAthenaHealthClient } from "../shared";

export async function getResourceBundleByResourceId(
  params: GetResourceBundleByResourceIdClientRequest
): Promise<Bundle> {
  const {
    tokenInfo,
    cxId,
    practiceId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    resourceId,
    useCachedBundle,
  } = params;
  const client = await createAthenaHealthClient({
    cxId,
    practiceId,
    ...(tokenInfo && { tokenInfo }),
  });
  const mappings =
    resourceType === "Encounter"
      ? await getSecondaryMappings({
          ehr: EhrSources.athena,
          practiceId,
          schema: athenaSecondaryMappingsSchema,
        })
      : undefined;
  const bundle = await client.getResourceBundleByResourceId({
    cxId,
    metriportPatientId,
    athenaPatientId: ehrPatientId,
    resourceId,
    resourceType,
    useCachedBundle,
    ...(mappings?.contributionEncounterAppointmentTypesBlacklist
      ? {
          attachAppointmentType: true,
        }
      : {}),
    ...(mappings?.contributionEncounterSummariesEnabled
      ? {
          fetchEncounterSummary: true,
        }
      : {}),
  });
  return bundle;
}

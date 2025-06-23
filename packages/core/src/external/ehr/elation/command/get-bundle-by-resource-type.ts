import { Bundle } from "@medplum/fhirtypes";
import { buildConversionFhirHandler } from "../../../../command/conversion-fhir/conversion-fhir-factory";
import { GetBundleByResourceTypeClientRequest } from "../../command/get-bundle-by-resource-type";
import { createElationHealthClient } from "../shared";

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
  const client = await createElationHealthClient({
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  const handler = buildConversionFhirHandler();
  const bundle = await client.getBundleByResourceType({
    cxId,
    metriportPatientId,
    elationPatinetId: ehrPatientId,
    resourceType,
    fhirConverter: async (payload: string) => {
      return await handler.convertToFhir({
        payload,
        patientId: metriportPatientId,
        unusedSegments: "",
        invalidAccess: "",
        source: "elation",
      });
    },
    useCachedBundle,
  });
  return bundle;
}

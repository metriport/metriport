import { Bundle } from "@medplum/fhirtypes";
import { ehrFhirResourceBundleSchema } from "@metriport/shared/interface/external/ehr/fhir-resource";
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
    elationPatientId: ehrPatientId,
    resourceType,
    fhirConverterToEhrBundle: async params => {
      const conversionResult = await handler.convertToFhir({
        ...params,
        cxId,
        patientId: metriportPatientId,
      });
      return ehrFhirResourceBundleSchema.parse(conversionResult.bundle);
    },
    useCachedBundle,
  });
  return bundle;
}

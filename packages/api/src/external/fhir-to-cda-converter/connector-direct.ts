import { splitBundleByCompositions } from "@metriport/core/fhir-to-cda/composition-splitter";
import { convertFhirBundleToCda } from "@metriport/core/fhir-to-cda/fhir-to-cda";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { FhirToCdaConverter, FhirToCdaConverterRequest } from "./connector";

export class FhirToCdaConverterDirect implements FhirToCdaConverter {
  async requestConvert({ cxId, bundle, toSplit }: FhirToCdaConverterRequest): Promise<string[]> {
    const organization = await getOrganizationOrFail({ cxId });
    const bundles = toSplit ? splitBundleByCompositions(bundle) : bundle;
    return convertFhirBundleToCda(bundles, organization.oid);
  }
}

import { convertFhirBundleToCda } from "@metriport/core/fhir-to-cda/fhir-to-cda";
import { uploadCdaDocuments } from "@metriport/core/fhir-to-cda/upload";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { toFHIR as toFhirOrganization } from "../fhir/organization";
import { FhirToCdaConverter, FhirToCdaConverterRequest } from "./connector";

export class FhirToCdaConverterDirect implements FhirToCdaConverter {
  async requestConvert({
    cxId,
    patientId,
    docId,
    bundle,
  }: FhirToCdaConverterRequest): Promise<void> {
    const organization = await getOrganizationOrFail({ cxId });
    const fhirOrganization = toFhirOrganization(organization);
    const converted = convertFhirBundleToCda(bundle, organization.oid);

    await uploadCdaDocuments({
      cxId,
      patientId,
      cdaBundles: converted,
      organization: fhirOrganization,
      docId,
    });
  }
}

import { makeFhirToCdaConverter } from "../../../external/fhir-to-cda-converter/converter-factory";
import { toFHIR as toFHIROrganization } from "../../../external/fhir/organization";
import { Bundle } from "../../../routes/medical/schemas/fhir";
import { getOrganizationOrFail } from "../organization/get-organization";

export async function convertToCdaAndUpload(
  cxId: string,
  patientId: string,
  validatedBundle: Bundle
): Promise<void> {
  const cdaConverter = makeFhirToCdaConverter();
  const organization = await getOrganizationOrFail({ cxId });

  try {
    const fhirOrganization = toFHIROrganization(organization);
    cdaConverter.requestConvert({
      cxId,
      patientId,
      bundle: validatedBundle,
      organization: fhirOrganization,
    });
  } catch (error) {
    throw new Error(`Error converting FHIR to CDA: ${error}`);
  }
}

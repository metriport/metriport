import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { makeFhirToCdaConverter } from "../../../external/fhir-to-cda-converter/converter-factory";
import { toFHIR as toFHIROrganization } from "../../../external/fhir/organization";
import { Bundle } from "../../../routes/medical/schemas/fhir";
import { getOrganizationOrFail } from "../organization/get-organization";

export async function convertFhirToCda(
  cxId: string,
  patientId: string,
  validatedBundle: Bundle
): Promise<string[]> {
  const { log } = out(`convertFhirToCda - cxId: ${cxId}, patientId: ${patientId}`);
  const cdaConverter = makeFhirToCdaConverter();
  const organization = await getOrganizationOrFail({ cxId });

  try {
    const fhirOrganization = toFHIROrganization(organization);
    return await cdaConverter.requestConvert({
      cxId,
      patientId,
      bundle: validatedBundle,
      organization: fhirOrganization,
      orgOid: organization.oid,
    });
  } catch (error) {
    const msg = `Error converting FHIR to CDA`;
    log(`${msg} - error: ${error}`);
    capture.error(msg, { extra: { error, cxId, patientId } });
    throw error;
  }
}

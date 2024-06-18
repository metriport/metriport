import { Organization } from "@medplum/fhirtypes";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { makeFhirToCdaConverter } from "../../../external/fhir-to-cda-converter/converter-factory";
import { Bundle } from "../../../routes/medical/schemas/fhir";

export async function convertFhirToCda({
  cxId,
  patientId,
  docId,
  validatedBundle,
  fhirOrganization,
  orgOid,
}: {
  cxId: string;
  patientId: string;
  docId: string;
  validatedBundle: Bundle;
  fhirOrganization: Organization;
  orgOid: string;
}): Promise<void> {
  const { log } = out(`convertFhirToCda - cxId: ${cxId}, patientId: ${patientId}`);
  const cdaConverter = makeFhirToCdaConverter();

  try {
    await cdaConverter.requestConvert({
      cxId,
      patientId,
      docId,
      bundle: validatedBundle,
      organization: fhirOrganization,
      orgOid,
    });
  } catch (error) {
    const msg = `Error converting FHIR to CDA`;
    log(`${msg} - error: ${error}`);
    capture.error(msg, { extra: { error, cxId, patientId } });
    throw error;
  }
}

import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { makeFhirToCdaConverter } from "../../../external/fhir-to-cda-converter/converter-factory";
import { Bundle as ValidBundle } from "../../../routes/medical/schemas/fhir";
import { Bundle as MedplumBundle } from "@medplum/fhirtypes";

export async function convertFhirToCda({
  cxId,
  bundle: bundle,
  splitCompositions = true,
}: {
  cxId: string;
  bundle: ValidBundle | MedplumBundle;
  splitCompositions?: boolean;
}): Promise<string[]> {
  const { log } = out(`convertFhirToCda - cxId: ${cxId}`);
  const cdaConverter = makeFhirToCdaConverter();
  if (!bundle.entry) bundle.entry = [];

  try {
    return cdaConverter.requestConvert({
      cxId,
      bundle: bundle as ValidBundle,
      splitCompositions,
    });
  } catch (error) {
    const msg = `Error converting FHIR to CDA`;
    log(`${msg} - error: ${error}`);
    capture.error(msg, { extra: { error, cxId, splitCompositions } });
    throw error;
  }
}

import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { makeFhirToCdaConverter } from "../../../external/fhir-to-cda-converter/converter-factory";
import { Bundle } from "../../../routes/medical/schemas/fhir";

export async function convertFhirToCda({
  cxId,
  validatedBundle,
  splitCompositions = true,
}: {
  cxId: string;
  validatedBundle: Bundle;
  splitCompositions?: boolean;
}): Promise<string[]> {
  const { log } = out(`convertFhirToCda - cxId: ${cxId}`);
  const cdaConverter = makeFhirToCdaConverter();

  try {
    return cdaConverter.requestConvert({
      cxId,
      bundle: validatedBundle,
      splitCompositions,
    });
  } catch (error) {
    const msg = `Error converting FHIR to CDA`;
    log(`${msg} - error: ${error}`);
    capture.error(msg, { extra: { error, cxId, splitCompositions } });
    throw error;
  }
}

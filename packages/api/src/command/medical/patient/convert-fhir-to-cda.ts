import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { makeFhirToCdaConverter } from "../../../external/fhir-to-cda-converter/converter-factory";
import { Bundle } from "../../../routes/medical/schemas/fhir";

export async function convertFhirToCda({
  cxId,
  validatedBundle,
  toSplit = true,
}: {
  cxId: string;
  validatedBundle: Bundle;
  toSplit?: boolean;
}): Promise<string[]> {
  const { log } = out(`convertFhirToCda - cxId: ${cxId}`);
  const cdaConverter = makeFhirToCdaConverter();

  try {
    return cdaConverter.requestConvert({
      cxId,
      bundle: validatedBundle,
      toSplit,
    });
  } catch (error) {
    const msg = `Error converting FHIR to CDA`;
    log(`${msg} - error: ${error}`);
    capture.error(msg, { extra: { error, cxId } });
    throw error;
  }
}

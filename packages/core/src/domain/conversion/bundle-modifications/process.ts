import { Bundle, Resource } from "@medplum/fhirtypes";
import { deduplicate } from "../../../external/fhir/consolidated/deduplicate";
import { hydrate } from "../../../external/fhir/consolidated/hydrate";
import { normalize } from "../../../external/fhir/consolidated/normalize";

export type BundleProcessingOptions = {
  hydrate?: boolean;
  normalize?: boolean;
  deduplicate?: boolean;
};

/**
 * Processes a FHIR bundle through a series of improvements.
 * Each step is optional and can be controlled via the options parameter.
 * They all default to true.
 *
 * @param bundle The FHIR bundle to process
 * @param cxId The customer ID
 * @param patientId The patient ID
 * @param options Configuration for which processing steps to run
 * @returns The processed bundle after the selected improvements
 */
export async function processBundle({
  bundle,
  cxId,
  patientId,
  options = {},
}: {
  bundle: Bundle<Resource>;
  cxId: string;
  patientId: string;
  options?: BundleProcessingOptions;
}): Promise<Bundle<Resource>> {
  const {
    hydrate: shouldHydrate = true,
    normalize: shouldNormalize = true,
    deduplicate: shouldDeduplicate = true,
  } = options;

  let processedBundle = bundle;

  if (shouldHydrate) {
    processedBundle = await hydrate({ cxId, patientId, bundle: processedBundle });
  }

  if (shouldNormalize) {
    processedBundle = await normalize({ cxId, patientId, bundle: processedBundle });
  }

  if (shouldDeduplicate) {
    processedBundle = await deduplicate({ cxId, patientId, bundle: processedBundle });
  }

  return processedBundle;
}

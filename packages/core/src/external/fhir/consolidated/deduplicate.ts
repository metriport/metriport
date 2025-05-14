import { Bundle, Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { dangerouslyDeduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { out } from "../../../util";
import { EventMessageV1, EventTypes, analyticsAsync } from "../../analytics/posthog";

/**
 * This function is dangerous because it mutates the bundle in place.
 *
 * @param {Object} params - The parameters for deduplication
 * @param {string} params.cxId - The customer ID
 * @param {string} params.patientId - The patient ID
 * @param {Bundle<Resource>} params.bundle - The FHIR bundle to deduplicate
 */
export async function dangerouslyDeduplicate({
  cxId,
  patientId,
  bundle,
}: {
  cxId: string;
  patientId: string;
  bundle: Bundle<Resource>;
}): Promise<void> {
  const { log } = out(`Deduplicate. cx ${cxId}, pt: ${patientId}`);
  const startedAt = new Date();
  const initialBundleLength = bundle.entry?.length;
  dangerouslyDeduplicateFhir(bundle, cxId, patientId);
  const finalBundleLength = bundle.entry?.length;

  const duration = elapsedTimeFromNow(startedAt);
  const metrics: EventMessageV1 = {
    distinctId: cxId,
    event: EventTypes.fhirDeduplication,
    properties: {
      patientId: patientId,
      initialBundleLength,
      finalBundleLength,
      duration,
    },
  };
  log(`Finished deduplication in ${duration} ms... Metrics: ${JSON.stringify(metrics)}`);

  await analyticsAsync(metrics);
}

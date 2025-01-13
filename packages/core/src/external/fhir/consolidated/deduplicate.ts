import { Bundle, Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { deduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { out } from "../../../util";
import { EventMessageV1, EventTypes, analytics } from "../../analytics/posthog";

export function deduplicate({
  cxId,
  patientId,
  bundle,
}: {
  cxId: string;
  patientId: string;
  bundle: Bundle<Resource>;
}): Bundle<Resource> {
  const { log } = out(`Hydrating FHIR for cxId ${cxId}, patientId ${patientId}`);
  const startedAt = new Date();
  const dedupedBundle = deduplicateFhir(bundle, cxId, patientId);

  const duration = elapsedTimeFromNow(startedAt);
  const metrics: EventMessageV1 = {
    distinctId: cxId,
    event: EventTypes.fhirDeduplication,
    properties: {
      patientId: patientId,
      initialBundleLength: bundle.entry?.length,
      finalBundleLength: dedupedBundle.entry?.length,
      duration,
    },
  };
  log(`Finished deduplication in ${duration} ms... Metrics: ${JSON.stringify(metrics)}`);

  analytics(metrics);
  return dedupedBundle;
}

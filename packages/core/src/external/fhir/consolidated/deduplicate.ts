import { Bundle, Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { deduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { analytics, EventTypes } from "../../analytics/posthog";

export function deduplicate({
  cxId,
  patientId,
  bundle,
}: {
  cxId: string;
  patientId: string;
  bundle: Bundle<Resource>;
}): Bundle<Resource> {
  const startedAt = new Date();
  const dedupedBundle = deduplicateFhir(bundle);

  const deduplicationAnalyticsProps = {
    distinctId: cxId,
    event: EventTypes.fhirDeduplication,
    properties: {
      patientId: patientId,
      initialBundleLength: bundle.entry?.length,
      finalBundleLength: dedupedBundle.entry?.length,
      duration: elapsedTimeFromNow(startedAt),
    },
  };
  analytics(deduplicationAnalyticsProps);
  return dedupedBundle;
}

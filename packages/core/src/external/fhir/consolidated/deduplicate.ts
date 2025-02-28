import { Bundle, Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { deduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { out } from "../../../util";
import { EventMessageV1, EventTypes, analytics } from "../../analytics/posthog";

export async function deduplicate({
  cxId,
  patientId,
  bundle,
}: {
  cxId: string;
  patientId: string;
  bundle: Bundle<Resource>;
}): Promise<Bundle<Resource>> {
  const { log } = out(`Deduplicate. cx ${cxId}, pt: ${patientId}`);
  const startedAt = new Date();
  const dedupedBundle = deduplicateFhir(bundle, cxId, patientId);

  const duration = elapsedTimeFromNow(startedAt);
  const metrics: EventMessageV1 = {
    distinctId: cxId,
    event: EventTypes.fhirDeduplication,
    properties: {
      patientId,
      preDedupBundleSize: bundle.entry?.length,
      postDedupBundleSize: dedupedBundle.entry?.length,
      dedupDurationMs: duration,
    },
  };

  log(`Finished deduplication in ${duration} ms... Metrics: ${JSON.stringify(metrics)}`);
  analytics(metrics);
  return dedupedBundle;
}

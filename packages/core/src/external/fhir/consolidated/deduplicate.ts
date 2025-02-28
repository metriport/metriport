import { Bundle, Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { deduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { out } from "../../../util";
import { EventMessageV1, EventTypes } from "../../analytics/posthog";

// TODO: 2731 - Refactor metrics / analytics
export async function deduplicate({
  cxId,
  patientId,
  bundle,
}: {
  cxId: string;
  patientId: string;
  bundle: Bundle<Resource>;
}): Promise<{
  bundle: Bundle<Resource>;
  metrics: EventMessageV1;
}> {
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
  return { bundle: dedupedBundle, metrics };
}

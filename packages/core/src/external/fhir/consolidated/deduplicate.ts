import { Bundle, Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { deduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { out } from "../../../util";
import { EventMessageV1, EventTypes, analyticsAsync } from "../../analytics/posthog";

export async function deduplicate({
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
  deduplicateFhir(bundle, cxId, patientId);
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

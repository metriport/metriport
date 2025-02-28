import { Bundle, Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { out } from "../../../util";
import { EventMessageV1, EventTypes, analytics } from "../../analytics/posthog";
import { normalizeFhir } from "../normalization/normalize-fhir";

export async function normalize({
  cxId,
  patientId,
  bundle,
}: {
  cxId: string;
  patientId: string;
  bundle: Bundle<Resource>;
}): Promise<Bundle<Resource>> {
  const { log } = out(`Normalize. cx: ${cxId}, pt: ${patientId}`);
  const startedAt = new Date();

  const normalizedBundle = normalizeFhir(bundle);

  // TODO: 2731 - Create and use helper functions to create analytics events for Posthog
  const duration = elapsedTimeFromNow(startedAt);
  const metrics: EventMessageV1 = {
    distinctId: cxId,
    event: EventTypes.fhirNormalization,
    properties: {
      patientId: patientId,
      normalizeBundleSize: normalizedBundle.entry?.length,
      duration,
    },
  };

  log(`Finished normalization in ${duration} ms... Metrics: ${JSON.stringify(metrics)}`);
  analytics(metrics);
  return normalizedBundle;
}

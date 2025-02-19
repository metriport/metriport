import { Bundle, Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { out } from "../../../util";
import { EventMessageV1, EventTypes, analyticsAsync } from "../../analytics/posthog";
import { normalizeFhir } from "../normalization/normalize-fhir";

export async function normalize({
  cxId,
  patientId,
  bundle,
  postHogApiKey,
}: {
  cxId: string;
  patientId: string;
  bundle: Bundle<Resource>;
  postHogApiKey?: string | undefined;
}): Promise<Bundle<Resource>> {
  const { log } = out(`Normalize. cx: ${cxId}, pt: ${patientId}`);
  const startedAt = new Date();

  const normalizedBundle = normalizeFhir(bundle);

  const duration = elapsedTimeFromNow(startedAt);
  const metrics: EventMessageV1 = {
    distinctId: cxId,
    event: EventTypes.fhirNormalization,
    properties: {
      patientId: patientId,
      bundleLength: normalizedBundle.entry?.length,
      duration,
    },
  };

  log(`Finished normalization in ${duration} ms... Metrics: ${JSON.stringify(metrics)}`);
  if (postHogApiKey) {
    await analyticsAsync(metrics, postHogApiKey);
  }

  return normalizedBundle;
}

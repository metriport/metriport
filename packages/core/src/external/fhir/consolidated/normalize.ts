import { Bundle, Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { out } from "../../../util";
import { EventMessageV1, EventTypes, analytics } from "../../analytics/posthog";
import { normalizeFhir } from "../normalization/normalize-fhir";

export function normalize({
  cxId,
  patientId,
  bundle,
}: {
  cxId: string;
  patientId: string;
  bundle: Bundle<Resource>;
}): Bundle<Resource> {
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

  analytics(metrics);
  return normalizedBundle;
}

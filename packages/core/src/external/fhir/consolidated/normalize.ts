import { Bundle, Resource } from "@medplum/fhirtypes";
import { emptyFunction } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { out } from "../../../util";
import { EventMessageV1, EventTypes, analyticsAsync } from "../../analytics/posthog";
import { normalizeFhir } from "../normalization/normalize-fhir";

export async function normalize({
  cxId,
  patientId,
  bundle,
  isVerbose = true,
}: {
  cxId: string;
  patientId: string;
  bundle: Bundle<Resource>;
  isVerbose?: boolean;
}): Promise<Bundle<Resource>> {
  const { log: logFn } = out(`Normalize. cx: ${cxId}, pt: ${patientId}`);
  const log = isVerbose ? logFn : emptyFunction;
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

  await analyticsAsync(metrics);
  return normalizedBundle;
}

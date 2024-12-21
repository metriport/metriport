import { Bundle, Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { out } from "../../../util";
import { normalizeFhir } from "../normalization/normalize-fhir";
import { EventMessageV1, EventTypes, analytics } from "../../analytics/posthog";

export function normalize({
  cxId,
  patientId,
  bundle,
}: {
  cxId?: string;
  patientId: string;
  bundle: Bundle<Resource>;
}): Bundle<Resource> {
  const { log } = out(`Normalizing FHIR for cxId ${cxId}, patientId ${patientId}`);
  const startedAt = new Date();

  const normalizedBundle = normalizeFhir(bundle);

  if (cxId) {
    const normalizationAnalyticsProps: EventMessageV1 = {
      distinctId: cxId,
      event: EventTypes.fhirNormalization,
      properties: {
        patientId: patientId,
        bundleLength: normalizedBundle.entry?.length,
        duration: elapsedTimeFromNow(startedAt),
      },
    };
    analytics(normalizationAnalyticsProps);
  }

  log(`Finished normalization in ${elapsedTimeFromNow(startedAt)} ms...`);
  return normalizedBundle;
}

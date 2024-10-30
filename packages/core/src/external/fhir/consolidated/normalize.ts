import { Bundle, Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { normalizeFhir } from "../../../fhir-normalization/normalize-fhir";
import { EventTypes, analytics } from "../../analytics/posthog";

export function normalize({
  cxId,
  patientId,
  bundle,
}: {
  cxId: string;
  patientId: string;
  bundle: Bundle<Resource>;
}): Bundle<Resource> {
  const startedAt = new Date();
  const normalizedBundle = normalizeFhir(bundle, cxId, patientId);

  const normalizationAnalyticsProps = {
    distinctId: cxId,
    event: EventTypes.fhirNormalization,
    properties: {
      patientId: patientId,
      bundleLength: normalizedBundle.entry?.length,
      duration: elapsedTimeFromNow(startedAt),
    },
  };
  analytics(normalizationAnalyticsProps);
  return normalizedBundle;
}

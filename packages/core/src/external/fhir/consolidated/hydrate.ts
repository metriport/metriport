import { Bundle, Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { hydrateFhir } from "../../../fhir-hydration/hydrate-fhir";
import { EventTypes, analytics } from "../../analytics/posthog";

export function hydrate({
  cxId,
  patientId,
  bundle,
}: {
  cxId: string;
  patientId: string;
  bundle: Bundle<Resource>;
}): Bundle<Resource> {
  const startedAt = new Date();
  const hydratedBundle = hydrateFhir(bundle, cxId, patientId);

  const hydrationAnalyticsProps = {
    distinctId: cxId,
    event: EventTypes.fhirHydration,
    properties: {
      patientId: patientId,
      bundleLength: hydratedBundle.entry?.length,
      duration: elapsedTimeFromNow(startedAt),
    },
  };
  analytics(hydrationAnalyticsProps);
  return hydratedBundle;
}

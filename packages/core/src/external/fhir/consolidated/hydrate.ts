import { Bundle, Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { out } from "../../../util";
import { EventMessageV1, EventTypes, analytics } from "../../analytics/posthog";
import { hydrateFhir } from "../hydration/hydrate-fhir";

export async function hydrate({
  cxId,
  patientId,
  bundle,
  termServerUrl,
}: {
  cxId?: string;
  patientId: string;
  bundle: Bundle<Resource>;
  termServerUrl?: string;
}): Promise<Bundle<Resource>> {
  const { log } = out(`Hydrating FHIR for cxId ${cxId}, patientId ${patientId}`);
  const startedAt = new Date();

  const hydratedBundle = await hydrateFhir(bundle, termServerUrl);

  if (cxId) {
    const hydrationAnalyticsProps: EventMessageV1 = {
      distinctId: cxId,
      event: EventTypes.fhirNormalization,
      properties: {
        patientId: patientId,
        bundleLength: hydratedBundle.entry?.length,
        duration: elapsedTimeFromNow(startedAt),
      },
    };
    analytics(hydrationAnalyticsProps);
  }

  log(`Finished hydration in ${elapsedTimeFromNow(startedAt)} ms...`);
  return hydratedBundle;
}

import { Bundle, Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { out } from "../../../util";
import { EventMessageV1, EventTypes, analytics } from "../../analytics/posthog";
import { hydrateFhir } from "../hydration/hydrate-fhir";

export async function hydrate({
  cxId,
  patientId,
  bundle,
}: {
  cxId: string;
  patientId: string;
  bundle: Bundle<Resource>;
}): Promise<Bundle<Resource>> {
  const { log } = out(`Hydrate. cx: ${cxId}, pt: ${patientId}`);
  const startedAt = new Date();

  // TODO: 2731 - Create and use helper functions to create analytics events for Posthog
  const metrics: EventMessageV1 = {
    distinctId: cxId,
    event: EventTypes.fhirHydration,
    properties: {
      patientId: patientId,
      bundleSize: bundle.entry?.length,
    },
  };

  const { metadata, data: hydratedBundle } = await hydrateFhir(bundle, log);
  const duration = elapsedTimeFromNow(startedAt);
  if (metadata) {
    metrics.properties = {
      ...metrics.properties,
      duration,
      ...metadata,
    };
  }

  log(`Finished hydration in ${duration} ms... Metrics: ${JSON.stringify(metrics)}`);
  analytics(metrics);

  return hydratedBundle;
}

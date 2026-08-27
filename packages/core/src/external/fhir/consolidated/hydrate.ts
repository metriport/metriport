import { Bundle, Resource } from "@medplum/fhirtypes";
import { emptyFunction } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { isHydrateConditionCodeByDisplayFeatureFlagEnabledForCx } from "../../../command/feature-flags/domain-ffs";
import { out } from "../../../util";
import { analyticsAsync, EventMessageV1, EventTypes } from "../../analytics/posthog";
import { hydrateFhir, HydrationOptions } from "../hydration/hydrate-fhir";

export async function hydrate({
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
  const { log: logFn } = out(`Hydrate. cx: ${cxId}, pt: ${patientId}`);
  const log = isVerbose ? logFn : emptyFunction;
  const startedAt = new Date();

  const metrics: EventMessageV1 = {
    distinctId: cxId,
    event: EventTypes.fhirHydration,
    properties: {
      patientId: patientId,
      bundleLength: bundle.entry?.length,
    },
  };

  const isLookupConditionCodeByDisplayEnabled =
    await isHydrateConditionCodeByDisplayFeatureFlagEnabledForCx(cxId);
  const options: HydrationOptions = {
    lookupConditionCodeByDisplay: isLookupConditionCodeByDisplayEnabled,
  };

  const { metadata, data: hydratedBundle } = await hydrateFhir({
    fhirBundle: bundle,
    options,
    log,
  });
  const duration = elapsedTimeFromNow(startedAt);
  if (metadata) {
    metrics.properties = {
      ...metrics.properties,
      duration,
      ...metadata,
    };
  }

  log(`Finished hydration in ${duration} ms... Metrics: ${JSON.stringify(metrics)}`);
  await analyticsAsync(metrics);
  return hydratedBundle;
}

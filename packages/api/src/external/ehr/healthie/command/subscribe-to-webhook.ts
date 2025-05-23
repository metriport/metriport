import { MetriportError } from "@metriport/shared";
import { healthieSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/healthie/cx-mapping";
import {
  SubscriptionResource,
  SubscriptionWithSignatureSecret,
} from "@metriport/shared/interface/external/ehr/healthie/subscription";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import {
  getCxMappingOrFail,
  setSecondaryMappingsOnCxMappingById,
} from "../../../../command/mapping/cx";
import { createHealthieClient } from "../shared";

export async function subscribeToWebhook({
  cxId,
  healthiePracticeId,
  resource,
}: {
  cxId: string;
  healthiePracticeId: string;
  resource: SubscriptionResource;
}): Promise<SubscriptionWithSignatureSecret> {
  const cxMappingLookupParams = { externalId: healthiePracticeId, source: EhrSources.healthie };
  const cxMapping = await getCxMappingOrFail(cxMappingLookupParams);
  if (!cxMapping.secondaryMappings) {
    throw new MetriportError("Healthie secondary mappings not found", undefined, {
      externalId: healthiePracticeId,
      source: EhrSources.healthie,
    });
  }
  const secondaryMappings = healthieSecondaryMappingsSchema.parse(cxMapping.secondaryMappings);
  const api = await createHealthieClient({ cxId, practiceId: healthiePracticeId });
  const subscription = await api.subscribeToResource({ cxId, resource });
  const eventType = subscription.webhook_events?.[0]?.event_type;
  const secretKey = subscription.signature_secret;
  const url = subscription.url;
  if (!eventType || !secretKey || !url) {
    throw new MetriportError("Healthie event type or secret key or url not found", undefined, {
      externalId: healthiePracticeId,
      source: EhrSources.healthie,
    });
  }
  await setSecondaryMappingsOnCxMappingById({
    cxId,
    id: cxMapping.id,
    secondaryMappings: {
      ...secondaryMappings,
      webhooks: {
        ...secondaryMappings.webhooks,
        [eventType]: {
          url,
          secretKey,
        },
      },
    },
  });
  return subscription;
}

export async function subscribeToAllWebhooks({
  cxId,
  externalId,
}: {
  cxId: string;
  externalId: string;
}): Promise<void> {
  await subscribeToWebhook({
    cxId,
    healthiePracticeId: externalId,
    resource: "appointment.created",
  });
  await subscribeToWebhook({ cxId, healthiePracticeId: externalId, resource: "patient.created" });
}

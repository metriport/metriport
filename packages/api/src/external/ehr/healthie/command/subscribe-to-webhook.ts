import { MetriportError } from "@metriport/shared";
import { HealthieSecondaryMappings } from "@metriport/shared/interface/external/ehr/healthie/cx-mapping";
import {
  SubscriptionResource,
  SubscriptionWithSignatureSecret,
} from "@metriport/shared/interface/external/ehr/healthie/subscription";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { setSecondaryMappingsOnCxMappingById } from "../../../../command/mapping/cx";
import { getCxMappingAndParsedSecondaryMappings } from "../../shared/command/mapping/get-cx-mapping-and-secondary-mappings";
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
  const { parsedSecondaryMappings, cxMapping } =
    await getCxMappingAndParsedSecondaryMappings<HealthieSecondaryMappings>({
      ehr: EhrSources.healthie,
      practiceId: healthiePracticeId,
    });
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
      ...parsedSecondaryMappings,
      webhooks: {
        ...parsedSecondaryMappings.webhooks,
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

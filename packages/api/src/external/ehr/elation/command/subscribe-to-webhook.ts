import { ElationSecondaryMappings } from "@metriport/shared/interface/external/ehr/elation/cx-mapping";
import {
  CreatedSubscription,
  SubscriptionResource,
} from "@metriport/shared/interface/external/ehr/elation/subscription";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { setSecondaryMappingsOnCxMappingById } from "../../../../command/mapping/cx";
import { getCxMappingAndParsedSecondaryMappings } from "../../shared/command/mapping/get-cx-mapping-and-secondary-mappings";
import { createElationClient } from "../shared";

export async function subscribeToWebhook({
  cxId,
  elationPracticeId,
  resource,
}: {
  cxId: string;
  elationPracticeId: string;
  resource: SubscriptionResource;
}): Promise<CreatedSubscription> {
  const { parsedSecondaryMappings, cxMapping } =
    await getCxMappingAndParsedSecondaryMappings<ElationSecondaryMappings>({
      ehr: EhrSources.elation,
      practiceId: elationPracticeId,
    });
  const api = await createElationClient({ cxId, practiceId: elationPracticeId });
  const subscription = await api.subscribeToResource({ cxId, resource });
  await setSecondaryMappingsOnCxMappingById({
    cxId,
    id: cxMapping.id,
    secondaryMappings: {
      ...parsedSecondaryMappings,
      webhooks: {
        ...parsedSecondaryMappings.webhooks,
        [subscription.resource]: {
          url: subscription.target,
          signingKey: subscription.signing_pub_key,
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
  await subscribeToWebhook({ cxId, elationPracticeId: externalId, resource: "appointments" });
  await subscribeToWebhook({ cxId, elationPracticeId: externalId, resource: "patients" });
}

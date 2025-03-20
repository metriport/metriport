import { ElationSecondaryMappings } from "@metriport/shared/interface/external/ehr/elation/cx-mapping";
import {
  CreatedSubscription,
  SubscriptionResource,
} from "@metriport/shared/interface/external/ehr/elation/subscription";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import {
  getCxMappingOrFail,
  updateSecondaryMappingsOnCxMapping,
} from "../../../../command/mapping/cx";
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
  const cxMappingLookupParams = { externalId: elationPracticeId, source: EhrSources.elation };
  const cxMapping = await getCxMappingOrFail(cxMappingLookupParams);
  const secondaryMappings = cxMapping.secondaryMappings as ElationSecondaryMappings;
  const api = await createElationClient({ cxId, practiceId: elationPracticeId });
  const subscription = await api.subscribeToResource({ cxId, resource });
  await updateSecondaryMappingsOnCxMapping({
    ...cxMappingLookupParams,
    secondaryMappings: {
      ...secondaryMappings,
      webhooks: {
        ...secondaryMappings.webhooks,
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

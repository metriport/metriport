import { z } from "zod";
import { FitbitCollectionTypes } from "./constants";

const fitbitCollectionTypeMapping: { [key in FitbitCollectionTypes]: FitbitCollectionTypes } = {
  activities: FitbitCollectionTypes.activities,
  body: FitbitCollectionTypes.body,
  foods: FitbitCollectionTypes.foods,
  sleep: FitbitCollectionTypes.sleep,
  userRevokedAccess: FitbitCollectionTypes.userRevokedAccess,
};

export const fitbitWebhookNotificationSchema = z.array(
  z.object({
    collectionType: z.nativeEnum(fitbitCollectionTypeMapping),
    date: z.string(),
    ownerId: z.string(),
    ownerType: z.string(),
    subscriptionId: z.string(),
  })
);

export type FitbitWebhook = z.infer<typeof fitbitWebhookNotificationSchema>;

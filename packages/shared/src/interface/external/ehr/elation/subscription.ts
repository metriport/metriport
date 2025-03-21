import { z } from "zod";

export const subscriptionResources = ["appointments", "patients"] as const;
export type SubscriptionResource = (typeof subscriptionResources)[number];
export function isSubscriptionResource(resource: string): resource is SubscriptionResource {
  return subscriptionResources.includes(resource as SubscriptionResource);
}

export const subscriptionSchema = z.object({
  id: z.coerce.string(),
  resource: z.enum(subscriptionResources),
});
export type Subscription = z.infer<typeof subscriptionSchema>;
export const subscriptionsSchema = z.object({
  results: subscriptionSchema.array(),
});
export type Subscriptions = z.infer<typeof subscriptionsSchema>;

export const createdSubscriptionSchema = z.object({
  resource: z.enum(subscriptionResources),
  target: z.string(),
  signing_pub_key: z.string(),
});
export type CreatedSubscription = z.infer<typeof createdSubscriptionSchema>;

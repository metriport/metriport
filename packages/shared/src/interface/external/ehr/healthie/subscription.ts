import { z } from "zod";

export const subscriptionResources = ["appointment.created", "patient.created"] as const;
export type SubscriptionResource = (typeof subscriptionResources)[number];
export function isSubscriptionResource(resource: string): resource is SubscriptionResource {
  return subscriptionResources.includes(resource as SubscriptionResource);
}

export const subscriptionSchema = z.object({
  id: z.string(),
  event_type: z.string().nullable(),
  is_enabled: z.boolean(),
  should_retry: z.boolean(),
  url: z.string().nullable(),
  webhook_events: z
    .array(
      z.object({
        id: z.string(),
        event_type: z.string().nullable(),
      })
    )
    .nullable(),
  signature_secret: z.string().nullable(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;
export const subscriptionGraphqlSchema = z.object({
  data: z.object({
    webhook: subscriptionSchema.nullable(),
  }),
});
export type SubscriptionGraphql = z.infer<typeof subscriptionGraphqlSchema>;
export const subscriptionsGraphqlSchema = z.object({
  data: z.object({
    webhooks: subscriptionSchema.array(),
  }),
});
export type SubscriptionsGraphql = z.infer<typeof subscriptionsGraphqlSchema>;

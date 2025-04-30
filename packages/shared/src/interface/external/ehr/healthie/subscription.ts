import { z } from "zod";

export const subscriptionResources = ["appointment.created", "patient.created"] as const;
export type SubscriptionResource = (typeof subscriptionResources)[number];
export function isSubscriptionResource(resource: string): resource is SubscriptionResource {
  return subscriptionResources.includes(resource as SubscriptionResource);
}

const webhookEventSchema = z.object({
  id: z.string(),
  event_type: z.string().nullable(),
});

export const subscriptionSchema = z.object({
  id: z.string(),
  event_type: z.string().nullable(),
  is_enabled: z.boolean(),
  should_retry: z.boolean(),
  url: z.string().nullable(),
  webhook_events: webhookEventSchema.array(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;
export const subscriptionWithSignatureSecretSchema = subscriptionSchema.extend({
  signature_secret: z.string().nullable(),
});
export type SubscriptionWithSignatureSecret = z.infer<typeof subscriptionWithSignatureSecretSchema>;

export const subscriptionWithSignatureSecretGraphqlSchema = z.object({
  data: z.object({
    createWebhook: z.object({
      webhook: subscriptionWithSignatureSecretSchema.nullable(),
    }),
  }),
});
export type SubscriptionWithSignatureSecretGraphql = z.infer<
  typeof subscriptionWithSignatureSecretGraphqlSchema
>;

export const subscriptionListResponseGraphqlSchema = z.object({
  data: z.object({
    webhooks: subscriptionSchema.array(),
  }),
});
export type SubscriptionListResponseGraphql = z.infer<typeof subscriptionListResponseGraphqlSchema>;

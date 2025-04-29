export const subscriptionResources = ["appointment.created", "patient.created"] as const;
export type SubscriptionResource = (typeof subscriptionResources)[number];
export function isSubscriptionResource(resource: string): resource is SubscriptionResource {
  return subscriptionResources.includes(resource as SubscriptionResource);
}

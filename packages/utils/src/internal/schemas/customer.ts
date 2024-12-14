import { z } from "zod";

export const subscriptionStatusSchema = z.enum(["disabled", "active", "overdue"]);
export type SubscriptionStatusSchema = z.infer<typeof subscriptionStatusSchema>;

export const customerSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  subscriptionStatus: subscriptionStatusSchema,
  subscriptionCancelsAt: z.string().nullable(),
  stripeCxId: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
  devicesStripeSubscriptionItemId: z.string().nullable(),
  medicalStripeSubscriptionItemId: z.string().nullable(),
  isRoot: z.boolean(),
});
export type Customer = z.infer<typeof customerSchema>;

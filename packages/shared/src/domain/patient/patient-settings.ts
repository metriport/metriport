import { z } from "zod";

const subscriptionsSchema = z.object({
  adt: z.array(z.string()).optional(),
});

export type PatientSubscriptions = z.infer<typeof subscriptionsSchema>;

export const patientSettingsSchema = z.object({
  subscriptions: subscriptionsSchema.optional(),
});

export const patientSettingsRequestSchema = z.object({
  patientIds: z.array(z.string()),
  settings: patientSettingsSchema,
});

export const adtSubscriptionRequestSchema = z.object({
  patientIds: z.array(z.string()),
  hieName: z.string(),
});

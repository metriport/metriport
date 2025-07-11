import { z } from "zod";

const subscriptionsSchema = z.object({
  adt: z.array(z.string()).optional(),
});

export type PatientSubscriptions = z.infer<typeof subscriptionsSchema>;

export const patientSettingsSchema = z.object({
  subscriptions: subscriptionsSchema.optional(),
});

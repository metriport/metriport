import { z } from "zod";

const subscriptionsSchema = z.object({
  adt: z.boolean().optional(),
});

export type PatientSubscriptions = z.infer<typeof subscriptionsSchema>;

export const patientSettingsDataSchema = z.object({
  subscriptions: subscriptionsSchema.optional(),
});

export const patientSettingsSchema = z.object({
  settings: patientSettingsDataSchema.optional(),
});

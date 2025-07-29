import { z } from "zod";

const subscriptionsSchema = z.object({
  adt: z.array(z.string()).optional(),
});

export type PatientSubscriptions = z.infer<typeof subscriptionsSchema>;

export const patientSettingsSchema = z.object({
  subscriptions: subscriptionsSchema.optional(),
});
export type PatientSettings = z.infer<typeof patientSettingsSchema>;

export const bulkPatientSettingsRequestSchema = z.object({
  settings: patientSettingsSchema,
});
export type BulkPatientSettingsRequest = z.infer<typeof bulkPatientSettingsRequestSchema>;

export const patientSettingsRequestSchema = z.object({
  patientIds: z.array(z.string()),
  settings: patientSettingsSchema,
});
export type PatientSettingsRequest = z.infer<typeof patientSettingsRequestSchema>;

export const adtSubscriptionRequestSchema = z.object({
  patientIds: z.array(z.string()),
  hieName: z.string(),
});
export type AdtSubscriptionRequest = z.infer<typeof adtSubscriptionRequestSchema>;

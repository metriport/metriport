import { z } from "zod";

const subscriptionsSchema = z.object({
  adt: z.boolean().optional(),
});

export const patientSettingsSchema = z.object({
  subscriptions: subscriptionsSchema.optional(),
});

export type PatientSettings = z.infer<typeof patientSettingsSchema>;

export const upsertPatientSettingsBulkSchema = z.object({
  cxId: z.string(),
  patientIds: z.array(z.string()),
  settings: patientSettingsSchema,
});

export type UpsertPatientSettingsBulk = z.infer<typeof upsertPatientSettingsBulkSchema>;

import { z } from "zod";

const subscriptionsSchema = z.object({
  adt: z.boolean().optional(),
});

export const patientSettingsSchema = z.object({
  subscriptions: subscriptionsSchema.optional(),
});

export type PatientSettings = z.infer<typeof patientSettingsSchema>;

export const upsertPatientSettingsBaseSchema = z.object({
  cxId: z.string(),
  settings: patientSettingsSchema,
});

export const upsertPatientSettingsSchema = upsertPatientSettingsBaseSchema.and(
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("patientList"),
      patientIds: z.array(z.string()),
    }),
    z.object({
      type: z.literal("facility"),
      facilityId: z.string(),
    }),
  ])
);

export type UpsertPatientSettingsBase = z.infer<typeof upsertPatientSettingsBaseSchema>;
export type UpsertPatientSettings = z.infer<typeof upsertPatientSettingsSchema>;

import { z } from "zod";

const subscriptionsSchema = z.object({
  adt: z.boolean().optional(),
});

export type PatientSubscriptions = z.infer<typeof subscriptionsSchema>;

export const upsertPatientSettingsBaseSchema = z.object({
  cxId: z.string(),
  settings: z.object({
    subscriptions: subscriptionsSchema.optional(),
  }),
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

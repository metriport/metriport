import { z } from "zod";

export const medicationCreateResponseSchema = z.object({
  success: z.boolean(),
  errormessage: z.string().optional(),
  medicationentryid: z.string().optional(),
});
export type MedicationCreateResponse = z.infer<typeof medicationCreateResponseSchema>;

const medicationReferenceSchema = z.object({
  medication: z.string(),
  medicationid: z.number(),
});
export type MedicationReference = z.infer<typeof medicationReferenceSchema>;
export const medicationReferencesGetResponseSchema = medicationReferenceSchema.array();

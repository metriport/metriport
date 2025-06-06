import { z } from "zod";

export const createdAllergySchema = z.object({
  success: z.boolean(),
  errormessage: z.string().optional(),
});
export type CreatedAllergy = z.infer<typeof createdAllergySchema>;
export const createdAllergySuccessSchema = z.object({
  success: z.literal(true),
});
export type CreatedAllergySuccess = z.infer<typeof createdAllergySuccessSchema>;

const allergySchema = z.object({
  allergenid: z.coerce.string(),
  allergenname: z.string(),
  reactions: z
    .object({
      reactionname: z.string(),
      snomedcode: z.coerce.string(),
      severity: z.string().optional(),
      severitysnomedcode: z.coerce.string().optional(),
    })
    .array(),
});
export type Allergy = z.infer<typeof allergySchema>;
export const allergyListResponseSchema = z.object({
  allergies: allergySchema.array(),
});
export type AllergyListResponse = z.infer<typeof allergyListResponseSchema>;

const allergenReferenceSchema = z.object({
  allergenid: z.coerce.string(),
  allergenname: z.string(),
});
export type AllergenReference = z.infer<typeof allergenReferenceSchema>;
export const allergenReferencesSchema = allergenReferenceSchema.array();
export type AllergenReferences = z.infer<typeof allergenReferencesSchema>;

export const allergyReactionReferenceSchema = z.object({
  reactionname: z.string(),
  snomedcode: z.coerce.string(),
});
export type AllergyReactionReference = z.infer<typeof allergyReactionReferenceSchema>;
export const allergyReactionReferencesSchema = allergyReactionReferenceSchema.array();
export type AllergyReactionReferences = z.infer<typeof allergyReactionReferencesSchema>;

export const allergySeverityReferenceSchema = z.object({
  severity: z.string(),
  snomedcode: z.coerce.string(),
});
export type AllergySeverityReference = z.infer<typeof allergySeverityReferenceSchema>;
export const allergySeverityReferencesSchema = allergySeverityReferenceSchema.array();
export type AllergySeverityReferences = z.infer<typeof allergySeverityReferencesSchema>;

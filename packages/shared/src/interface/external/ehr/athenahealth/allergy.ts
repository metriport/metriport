import { z } from "zod";

export const createdAllergySchema = z.object({
  success: z.boolean(),
  errormessage: z.string().optional(),
  allergyid: z.coerce.string().optional(),
});
export type CreatedAllergy = z.infer<typeof createdAllergySchema>;
export const createdAllergySuccessSchema = z.object({
  success: z.literal(true),
  allergyid: z.coerce.string(),
});
export type CreatedAllergySuccess = z.infer<typeof createdAllergySuccessSchema>;

const allergenReferenceSchema = z.object({
  allergenid: z.coerce.string(),
  allergenname: z.string(),
});
export type AllergenReference = z.infer<typeof allergenReferenceSchema>;
export const allergenReferencesSchema = allergenReferenceSchema.array();
export type AllergenReferences = z.infer<typeof allergenReferencesSchema>;

const allergySchema = z.object({
  allergenid: z.coerce.string(),
  allergenname: z.string(),
  reactions: z
    .object({
      reactionname: z.string(),
      severity: z.string(),
      severitysnomedcode: z.coerce.string(),
      snomedcode: z.coerce.string(),
    })
    .array(),
});
export type Allergy = z.infer<typeof allergySchema>;
export const allergiesSchema = z.object({
  allergies: allergySchema.array(),
});
export type Allergies = z.infer<typeof allergiesSchema>;

export const allergyReactionReferenceSchema = z.object({
  reactionid: z.coerce.number(),
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

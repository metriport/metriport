import { z } from "zod";

export const createdClinicalDocumentSchema = z.object({
  success: z.boolean(),
  errormessage: z.string().optional(),
  clinicaldocumentid: z.coerce.string().optional(),
});
export type CreatedClinicalDocument = z.infer<typeof createdClinicalDocumentSchema>;
export const createdClinicalDocumentSuccessSchema = z.object({
  success: z.literal(true),
  clinicaldocumentid: z.coerce.string(),
});
export type CreatedClinicalDocumentSuccess = z.infer<typeof createdClinicalDocumentSuccessSchema>;

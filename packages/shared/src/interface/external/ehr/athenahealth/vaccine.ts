import { z } from "zod";

export const createdVaccineSchema = z.object({
  success: z.boolean(),
  errormessage: z.string().optional(),
  vaccineids: z.coerce.string().optional(),
});
export type CreatedVaccine = z.infer<typeof createdVaccineSchema>;
export const createdVaccineSuccessSchema = z.object({
  success: z.literal(true),
  vaccineids: z.coerce.string(),
});
export type CreatedVaccineSuccess = z.infer<typeof createdVaccineSuccessSchema>;

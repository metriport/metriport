import { z } from "zod";

export const createdVaccineSchema = z.object({
  vaccineids: z.coerce.string().array().optional(),
});
export type CreatedVaccines = z.infer<typeof createdVaccineSchema>;
export const createdVaccinesSuccessSchema = z.object({
  vaccineids: z.coerce.string().array().min(1),
});
export type CreatedVaccinesSuccess = z.infer<typeof createdVaccinesSuccessSchema>;

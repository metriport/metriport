import { z } from "zod";

export const createdVaccinesSchema = z.object({
  vaccineids: z.coerce.string().array().optional(),
});
export type CreatedVaccines = z.infer<typeof createdVaccinesSchema>;
export const createdVaccinesSuccessSchema = z.object({
  vaccineids: z.coerce.string().array().min(1),
});
export type CreatedVaccinesSuccess = z.infer<typeof createdVaccinesSuccessSchema>;

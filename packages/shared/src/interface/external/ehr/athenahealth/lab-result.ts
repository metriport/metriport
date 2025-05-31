import { z } from "zod";

export const createdLabResultSchema = z.object({
  success: z.boolean(),
  errormessage: z.string().optional(),
  labresultid: z.coerce.string().optional(),
});
export type CreatedLabResult = z.infer<typeof createdLabResultSchema>;
export const createdLabResultSuccessSchema = z.object({
  success: z.literal(true),
  labresultid: z.coerce.string(),
});
export type CreatedLabResultSuccess = z.infer<typeof createdLabResultSuccessSchema>;

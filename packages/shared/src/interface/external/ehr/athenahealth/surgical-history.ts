import { z } from "zod";

export const createdSurgicalHistorySchema = z.object({
  success: z.boolean(),
  errormessage: z.string().optional(),
  procedureids: z.coerce.string().array().optional(),
});
export type CreatedSurgicalHistory = z.infer<typeof createdSurgicalHistorySchema>;
export const createdSurgicalHistorySuccessSchema = z.object({
  success: z.literal(true),
  procedureids: z.coerce.string().array().min(1),
});
export type CreatedSurgicalHistorySuccess = z.infer<typeof createdSurgicalHistorySuccessSchema>;

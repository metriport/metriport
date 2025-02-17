import { z } from "zod";

export const createdProblemSchema = z.object({
  success: z.boolean(),
  errormessage: z.string().optional(),
  problemid: z.coerce.string().optional(),
});
export type CreatedProblem = z.infer<typeof createdProblemSchema>;
export const createdProblemSuccessSchema = z.object({
  success: z.literal(true),
  problemid: z.coerce.string(),
});
export type CreatedProblemSuccess = z.infer<typeof createdProblemSuccessSchema>;

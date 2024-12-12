import { z } from "zod";

export const problemCreateResponseSchema = z.object({
  success: z.boolean(),
  errormessage: z.string().optional(),
  problemid: z
    .number()
    .transform(val => `${val}`)
    .optional(),
});
export type ProblemCreateResponse = z.infer<typeof problemCreateResponseSchema>;

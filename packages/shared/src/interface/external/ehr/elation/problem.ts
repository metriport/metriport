import { z } from "zod";

export const createdProblemSchema = z.object({
  id: z.coerce.string(),
});
export type CreatedProblem = z.infer<typeof createdProblemSchema>;

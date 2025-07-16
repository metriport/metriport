import { z } from "zod";

export const practiceSchema = z.object({
  id: z.coerce.string(),
  physicians: z.coerce.string().array(),
  status: z.string(),
});
export type Practice = z.infer<typeof practiceSchema>;

export const practicesSchema = z.object({
  results: z.array(practiceSchema),
});
export type Practices = z.infer<typeof practicesSchema>;

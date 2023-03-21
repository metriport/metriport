import { z } from "zod";

export const baseUpdateSchema = z.object({
  eTag: z.string(),
});
export type BaseUpdateSchema = z.infer<typeof baseUpdateSchema>;

import { z } from "zod";

export const baseUpdateSchema = z.object({
  id: z.string(),
  eTag: z.string().optional(),
});

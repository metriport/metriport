import { z } from "zod";

export const createdLabSchema = z.object({
  id: z.coerce.string(),
});
export type CreatedLab = z.infer<typeof createdLabSchema>;

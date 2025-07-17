import { z } from "zod";

export const createdVitalSchema = z.object({
  id: z.coerce.string(),
});
export type CreatedVital = z.infer<typeof createdVitalSchema>;

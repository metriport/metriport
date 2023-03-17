import { z } from "zod";

export const linkCreateSchema = z.object({
  entityId: z.string(),
});

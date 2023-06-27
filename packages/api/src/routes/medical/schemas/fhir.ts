import { z } from "zod";

const typeSchema = z.enum(["collection"]);

export const bundleEntrySchema = z.object({
  resourceType: z.enum(["Bundle"]),
  type: typeSchema.optional(),
  entry: z.array(z.any()).optional(),
});

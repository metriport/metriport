import { z } from "zod";

const typeSchema = z.enum(["collection"]);

const bundleEntrySchema = z.array(
  z.object({
    resource: z.any(),
  })
);

export const bundleSchema = z.object({
  resourceType: z.enum(["Bundle"]),
  type: typeSchema.optional(),
  entry: bundleEntrySchema,
});

export type BundleEntry = z.infer<typeof bundleEntrySchema>;
export type Bundle = z.infer<typeof bundleSchema>;

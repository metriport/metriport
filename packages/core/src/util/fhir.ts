import { z } from "zod";

// TODO: We might want to remove these copy-pasted definitions from the API package and use this instead.
const typeSchema = z.enum(["collection"]);

const bundleEntrySchema = z.array(
  z.object({
    resource: z.any().refine(value => value !== undefined, { message: "Resource is required" }),
  })
);

export const bundleSchema = z.object({
  resourceType: z.enum(["Bundle"]),
  type: typeSchema,
  entry: bundleEntrySchema,
});

export type BundleEntry = z.infer<typeof bundleEntrySchema>;
export type Bundle = z.infer<typeof bundleSchema>;

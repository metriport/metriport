import { z } from "zod";
import { identifierSchema, meta, objectNumericValue, objectValue } from "./shared";
import { organizationSchema } from "./organization";

export const bundleSchema = z.object({
  xmlns: z.string(),
  id: objectValue,
  meta,
  type: objectValue,
  total: objectNumericValue,
  identifier: identifierSchema.optional(),
  entry: z.array(
    z.object({
      resource: z.object({
        Organization: organizationSchema.optional(),
      }),
    })
  ),
});

export type Bundle = z.infer<typeof bundleSchema>;

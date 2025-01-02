import { z } from "zod";
import { organizationSchema } from "./organization";
import { objectNumericValue } from "./shared";

export const stu3BundleSchema = z.object({
  total: objectNumericValue,
  entry: z.array(
    z.object({
      resource: z.object({
        Organization: organizationSchema.optional(),
      }),
    })
  ),
});

export type STU3Bundle = z.infer<typeof stu3BundleSchema>;

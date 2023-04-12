import { z } from "zod";
import { metaSchema, systemValueSchema, addressSchema, typeSchema } from "../shared";

const organizationSchema = z.object({
  resourceType: z.string(),
  id: z.string(),
  meta: metaSchema.optional(),
  identifier: z.array(systemValueSchema).optional(),
  active: z.boolean(),
  type: z.array(typeSchema),
  name: z.string(),
  telecom: z.array(systemValueSchema).optional(),
  address: z.array(addressSchema),
});

export type FHIROrganization = z.infer<typeof organizationSchema>;

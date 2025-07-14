import { z } from "zod";
import { patientIdentifierSchema } from "./identifier";

export const managingOrganizationSchema = z.object({
  identifier: z.array(patientIdentifierSchema.pick({ system: true })).min(1),
  name: z.string().optional().nullable(),
});

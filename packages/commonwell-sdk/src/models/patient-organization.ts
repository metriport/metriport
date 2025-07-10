import { z } from "zod";
import { patientIdentifierSchema } from "./identifier";

// TODO ENG-200 REMOVE THIS?
export const patientOrganizationSchema = z.object({
  type: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  display: z.string().optional().nullable(),
});

export const managingOrganizationSchema = z.object({
  identifier: z.array(patientIdentifierSchema.pick({ system: true })).min(1),
  name: z.string().optional().nullable(),
});

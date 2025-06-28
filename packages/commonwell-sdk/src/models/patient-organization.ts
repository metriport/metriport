import { z } from "zod";
import { identifierSchema } from "./identifier";

// TODO ENG-200 REMOVE THIS?
export const patientOrganizationSchema = z.object({
  type: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  display: z.string().optional().nullable(),
});

export const managingOrganizationSchema = z.object({
  identifier: z.array(identifierSchema.pick({ system: true })).min(1),
  name: z.string().optional().nullable(),
});

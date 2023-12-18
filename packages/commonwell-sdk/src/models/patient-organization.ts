import { z } from "zod";

export const patientOrganizationSchema = z.object({
  type: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  display: z.string().optional().nullable(),
});

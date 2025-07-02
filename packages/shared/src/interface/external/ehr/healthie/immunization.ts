import { z } from "zod";

export const immunizationSchema = z.object({
  id: z.string(),
  status: z.string(),
  cvx_code: z.string(),
  received_at: z.string(),
  additional_notes: z.string().nullable(),
});
export type Immunization = z.infer<typeof immunizationSchema>;

export const immunizationsGraphqlSchema = z.object({
  data: z.object({
    user: z.object({
      immunizations: immunizationSchema.array(),
    }),
  }),
});
export type ImmunizationsGraphql = z.infer<typeof immunizationsGraphqlSchema>;

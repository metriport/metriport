import { z } from "zod";

export const conditionSchema = z.object({
  id: z.string(),
  active: z.boolean().nullable(),
  icd_code: z.object({ code: z.string().nullable() }).nullable(),
  first_symptom_date: z.string().nullable(),
  end_date: z.string().nullable(),
});
export type Condition = z.infer<typeof conditionSchema>;

export const conditionsGraphqlSchema = z.object({
  data: z.object({
    user: z.object({
      diagnoses: conditionSchema.array(),
    }),
  }),
});
export type ConditionsGraphql = z.infer<typeof conditionsGraphqlSchema>;

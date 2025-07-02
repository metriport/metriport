import { z } from "zod";

export const conditionSchema = z.object({
  id: z.string(),
  first_symptom_date: z.string(),
  end_date: z.string().nullable(),
  active: z.boolean(),
  icd_code: z.object({
    code: z.string(),
    system: z.string(),
  }),
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

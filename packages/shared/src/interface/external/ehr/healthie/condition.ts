import { z } from "zod";

export const conditionSchema = z.object({
  id: z.string(),
  active: z.boolean().nullable(),
  icd_code: z.object({ code: z.string().nullable() }).nullable(),
  first_symptom_date: z.string().nullable(),
  end_date: z.string().nullable(),
  icd_code_id: z.string().nullable(),
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

export const icdCodesResponseGraphqlSchema = z.object({
  data: z.object({
    icdCodes: z.array(z.object({ id: z.string() })),
  }),
});
export type IcdCodesResponseGraphql = z.infer<typeof icdCodesResponseGraphqlSchema>;

const updateClientDiagnosisSchema = z.object({
  first_symptom_date: z.string().nullable(),
  active: z.boolean(),
  icd_code_id: z.string(),
});

export const updateClientDiagnosesGraphqlSchema = z.object({
  data: z.object({
    updateClient: z.object({
      user: z.object({
        id: z.string(),
        diagnoses: updateClientDiagnosisSchema.array(),
      }),
    }),
  }),
});
export type UpdateClientDiagnosesGraphql = z.infer<typeof updateClientDiagnosesGraphqlSchema>;

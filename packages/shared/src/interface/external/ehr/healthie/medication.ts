import { z } from "zod";

export const medicationSchema = z.object({
  id: z.string(),
  active: z.boolean(),
  code: z.string(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  directions: z.string().nullable(),
  dosage: z.string().nullable(),
  frequency: z.string().nullable(),
  comment: z.string().nullable(),
});
export type Medication = z.infer<typeof medicationSchema>;

export const medicationsGraphqlSchema = z.object({
  data: z.object({
    medications: medicationSchema.array(),
  }),
});
export type MedicationsGraphql = z.infer<typeof medicationsGraphqlSchema>;

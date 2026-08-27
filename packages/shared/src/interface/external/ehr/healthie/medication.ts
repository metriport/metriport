import { z } from "zod";

export const medicationSchema = z.object({
  id: z.string(),
  active: z.boolean().nullable(),
  name: z.string().nullable(),
  code: z.string().nullable(),
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

const dosageOptionSchema = z.object({
  id: z.string(),
  strength: z.string(),
});

const medicationOptionSchema = z.object({
  dosage_options: dosageOptionSchema.array(),
  id: z.string(),
  name: z.string(),
});

export const medicationOptionsResponseGraphqlSchema = z.object({
  data: z.object({
    medication_options: medicationOptionSchema.array(),
  }),
});
export type MedicationOptionsResponseGraphql = z.infer<
  typeof medicationOptionsResponseGraphqlSchema
>;

export type CreateMedicationParams = {
  start_date?: string;
  end_date?: string | undefined;
  directions?: string | undefined;
  dosage?: string | undefined;
  active: boolean;
};

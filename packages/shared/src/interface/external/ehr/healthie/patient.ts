import { z } from "zod";

export const patientSchema = z.object({
  id: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  dob: z.string().nullable(),
  gender: z.string().nullable(),
  email: z.string().nullable(),
  phone_number: z.string().nullable(),
  locations: z
    .object({
      line1: z.string(),
      line2: z.string(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
      country: z.string(),
    })
    .array()
    .nullable(),
});
export type Patient = z.infer<typeof patientSchema>;
export const patientGraphqlSchema = z.object({
  data: z.object({
    user: patientSchema.nullable(),
  }),
});
export type PatientGraphql = z.infer<typeof patientGraphqlSchema>;

export const patientQuickNotesSchema = z.object({
  id: z.string(),
  quick_notes: z.string().nullable(),
});
export type PatientQuickNotes = z.infer<typeof patientQuickNotesSchema>;
export const patientQuickNotesGraphqlSchema = z.object({
  data: z.object({
    user: patientQuickNotesSchema.nullable(),
  }),
});
export type PatientQuickNotesGraphql = z.infer<typeof patientQuickNotesGraphqlSchema>;

export const patientUpdateQuickNotesGraphqlSchema = z.object({
  data: z.object({
    updateClient: z.object({
      user: patientQuickNotesSchema.nullable(),
    }),
  }),
});
export type PatientUpdateQuickNotesGraphql = z.infer<typeof patientUpdateQuickNotesGraphqlSchema>;

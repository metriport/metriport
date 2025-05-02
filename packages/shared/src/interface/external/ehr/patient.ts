import { z } from "zod";

const address = z.object({
  state: z.string().optional(),
  line: z.string().array().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

const telecom = z.object({
  value: z.string().optional(),
  system: z.enum(["phone", "email"]).optional(),
  use: z.enum(["home", "mobile", "old", "temp", "work"]).optional(),
});

const name = z.object({
  family: z.string().optional(),
  given: z.string().array().optional(),
});

export const patientSchema = z.object({
  gender: z.string(),
  name: name.array().optional(),
  address: address.array().optional(),
  birthDate: z.string(),
  telecom: telecom.array().optional(),
});

export type Patient = z.infer<typeof patientSchema>;
export const patientSearchSchema = z.object({
  entry: z
    .object({
      resource: patientSchema,
    })
    .array()
    .optional(),
});
export type PatientSearch = z.infer<typeof patientSearchSchema>;

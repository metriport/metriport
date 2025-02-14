import { z } from "zod";

const address = z.object({
  state: z.string().optional(),
  line: z.string().array().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

const telecome = z.object({
  value: z.string(),
  system: z.enum(["phone", "email"]),
});

const name = z.object({
  family: z.string(),
  given: z.string().array(),
});

export const patientSchema = z.object({
  gender: z.string(),
  name: name.array().optional(),
  address: address.array().optional(),
  birthDate: z.string(),
  telecom: telecome.array().optional(),
});

export type Patient = z.infer<typeof patientSchema>;
export const patientSearchSchema = z.object({
  entry: z
    .object({
      resource: patientSchema,
    })
    .array(),
});
export type PatientSearch = z.infer<typeof patientSearchSchema>;

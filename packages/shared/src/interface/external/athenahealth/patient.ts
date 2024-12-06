import { z } from "zod";

const period = z.object({
  start: z.string(),
  end: z.string().optional(),
});

const address = z.object({
  use: z.string(),
  country: z.string(),
  period,
  state: z.string(),
  line: z.string().array(),
  city: z.string(),
  postalCode: z.string().optional(),
});

const telecome = z.object({
  value: z.string(),
  system: z.enum(["phone", "email"]),
});

const name = z.object({
  use: z.string(),
  period,
  family: z.string(),
  given: z.string().array(),
});

export const patientResourceSchema = z.object({
  gender: z.string(),
  name: name.array(),
  address: address.array().optional(),
  birthDate: z.string(),
  telecom: telecome.array().optional(),
});

export type PatientResource = z.infer<typeof patientResourceSchema>;

export const patientSearchResourceSchema = z.object({
  entry: z
    .object({
      resource: patientResourceSchema,
    })
    .array(),
});

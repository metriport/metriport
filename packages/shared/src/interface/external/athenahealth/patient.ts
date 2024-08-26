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
  postalCode: z.string(),
});

const telecome = z.object({
  use: z.string(),
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
  address: address.array(),
  birthDate: z.string(),
  telecom: telecome.array(),
});

export type PatientResource = z.infer<typeof patientResourceSchema>;

export const patientFhirResponseSchema = z.object({
  type: z.string(),
  timestamp: z.string(),
  entry: z
    .object({
      resource: patientResourceSchema,
      fullUrl: z.string(),
    })
    .array(),
  resourceType: z.string(),
});

export type PatientFhirResponse = z.infer<typeof patientFhirResponseSchema>;

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

const homeAddress = z.object({
  use: z.literal("home"),
  country: z.string(),
  period,
  state: z.string(),
  line: z.string().array(),
  city: z.string(),
  postalCode: z.string(),
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

export const patientResourceSchemaWithHomeAddress = patientResourceSchema
  .omit({
    address: true,
  })
  .extend({
    address: homeAddress.array(),
  });

export type PatientResource = z.infer<typeof patientResourceSchema>;
export type PatientResourceWithHomeAddress = z.infer<typeof patientResourceSchemaWithHomeAddress>;
export const patientSearchResourceSchema = z.object({
  entry: z
    .object({
      resource: patientResourceSchema,
    })
    .array(),
});

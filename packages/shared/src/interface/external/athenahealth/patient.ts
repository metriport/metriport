import { z } from "zod";

const address = z.object({
  country: z.string(),
  state: z.string(),
  line: z.string().array(),
  city: z.string(),
  postalCode: z.string().optional(),
});

const addressWithPostalCode = address
  .omit({
    postalCode: true,
  })
  .merge(
    z.object({
      postalCode: z.string(),
    })
  );

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
  name: name.array(),
  address: address.array().optional(),
  birthDate: z.string(),
  telecom: telecome.array().optional(),
});

export const patientSchemaWithValidAddress = patientSchema
  .omit({
    address: true,
  })
  .extend({
    address: addressWithPostalCode.array(),
  });

export type Patient = z.infer<typeof patientSchema>;
export type PatientWithValidAddress = z.infer<typeof patientSchemaWithValidAddress>;
export const patientSearchSchema = z.object({
  entry: z
    .object({
      resource: patientSchema,
    })
    .array(),
});
export type PatientSearch = z.infer<typeof patientSearchSchema>;

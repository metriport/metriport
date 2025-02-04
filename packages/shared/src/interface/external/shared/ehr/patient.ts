import { z } from "zod";

const addressFhirSchema = z.object({
  use: z.string(),
  country: z.string(),
  state: z.string(),
  line: z.string().array(),
  city: z.string(),
  postalCode: z.string().optional(),
});

const homeAddressWithPostalCodeFhirSchema = addressFhirSchema
  .omit({
    use: true,
    postalCode: true,
  })
  .merge(
    z.object({
      use: z.literal("home"),
      postalCode: z.string(),
    })
  );

const telecomFhirSchema = z.object({
  value: z.string(),
  system: z.enum(["phone", "email"]),
});

const nameFhirSchema = z.object({
  use: z.string(),
  family: z.string(),
  given: z.string().array(),
});

export const patientFhirSchema = z.object({
  gender: z.string(),
  name: nameFhirSchema.array(),
  address: addressFhirSchema.array().optional(),
  birthDate: z.string(),
  telecom: telecomFhirSchema.array().optional(),
});

export const patientWithValidHomeAddressFhirSchema = patientFhirSchema
  .omit({
    address: true,
  })
  .extend({
    address: homeAddressWithPostalCodeFhirSchema.array(),
  });

export type Patient = z.infer<typeof patientFhirSchema>;
export type PatientWithValidHomeAddress = z.infer<typeof patientWithValidHomeAddressFhirSchema>;
export const patientSearchFhirSchema = z.object({
  entry: z
    .object({
      resource: patientFhirSchema,
    })
    .array(),
});
export type PatientSearch = z.infer<typeof patientSearchFhirSchema>;

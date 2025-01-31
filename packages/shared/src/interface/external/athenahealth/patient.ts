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

const homeAddressWithPostalCode = address
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

export const patientSchema = z.object({
  gender: z.string(),
  name: name.array(),
  address: address.array().optional(),
  birthDate: z.string(),
  telecom: telecome.array().optional(),
});

export const patientSchemaWithValidHomeAddress = patientSchema
  .omit({
    address: true,
  })
  .extend({
    address: homeAddressWithPostalCode.array(),
  });

export type Patient = z.infer<typeof patientSchema>;
export type PatientWithValidHomeAddress = z.infer<typeof patientSchemaWithValidHomeAddress>;
export const patientSearchSchema = z.object({
  entry: z
    .object({
      resource: patientSchema,
    })
    .array(),
});
export type PatientSearch = z.infer<typeof patientSearchSchema>;

import { z } from "zod";

export const nameSchema = z.object({
  family: z.string(),
  given: z.array(z.string()),
});
export type Name = z.infer<typeof nameSchema>;

export const addressSchema = z.object({
  line: z.array(z.string()).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});
export type Address = z.infer<typeof addressSchema>;

export const telecomSchema = z.object({
  system: z.string().optional(),
  value: z.string().optional(),
});
export type Telecom = z.infer<typeof telecomSchema>;

export const personalIdentifierSchema = z.object({
  system: z.string().optional(),
  value: z.string().optional(),
});
export type PersonalIdentifier = z.infer<typeof personalIdentifierSchema>;

export const genderSchema = z.enum(["male", "female", "other", "unknown", "undefined"]).optional();
export type Gender = z.infer<typeof genderSchema>;

export const patientResourceSchema = z.object({
  resourceType: z.string().optional(),
  id: z.string().optional(),
  name: z.array(nameSchema),
  gender: genderSchema,
  birthDate: z.string(),
  address: z.array(addressSchema).optional(),
  telecom: z.array(telecomSchema).optional(),
  identifier: z.array(personalIdentifierSchema).optional(),
});

export type PatientResource = z.infer<typeof patientResourceSchema>;

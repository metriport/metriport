import { z } from "zod";
import { metaSchema, systemValueSchema, addressSchema } from "../shared";

export const nameSchema = z.object({
  use: z.string().optional(),
  family: z.string(),
  given: z.array(z.string()),
  prefix: z.array(z.string()).optional(),
});

export type Name = z.infer<typeof nameSchema>;

export const patientSchema = z.object({
  resourceType: z.string(),
  id: z.string(),
  meta: metaSchema.optional(),
  identifier: z.array(systemValueSchema).optional(),
  name: z.array(nameSchema),
  telecom: z.array(systemValueSchema).optional(),
  gender: z.string(),
  birthDate: z.string(),
  address: z.array(addressSchema),
  // WHAT ARE THESE?
  // extension
  // maritalStatus
  // communication
  // multipleBirthBoolean
});

export type FHIRPatient = z.infer<typeof patientSchema>;

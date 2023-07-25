import { z } from "zod";
import {
  driversLicenseType,
  genderAtBirthTypes,
  generalTypes,
} from "../../../models/medical/patient";
import { USState } from "../../../shared/geographic-locations";
import { addressSchema } from "./address";
import {
  defaultDateString,
  defaultNameString,
  defaultOptionalString,
  stripNonNumericChars,
} from "./shared";

const usStateSchema = z.nativeEnum(USState);

export const basePersonalIdentifierSchema = z.object({
  value: z.string(),
  period: z
    .object({
      start: z.string(),
      end: z.string().optional(),
    })
    .or(
      z.object({
        start: z.string().optional(),
        end: z.string(),
      })
    )
    .optional(),
  assigner: z.string().optional(),
});

export const driverLicenseIdentifierSchema = z.object({
  type: z.enum(driversLicenseType),
  state: usStateSchema,
});
export const generalTypeIdentifierSchema = z.object({
  type: z.enum(generalTypes),
});
export const personalIdentifierSchema = basePersonalIdentifierSchema.merge(
  driverLicenseIdentifierSchema
);
// TODO #369 reenable this when we manage to work with diff systems @ CW
// .or(basePersonalIdentifierSchema.merge(generalTypeIdentifierSchema));
export type PersonalIdentifier = z.infer<typeof personalIdentifierSchema>;

const phoneLength = 10;
export const contactSchema = z
  .object({
    phone: z.coerce
      .string()
      .transform(phone => stripNonNumericChars(phone))
      .refine(phone => phone.length === phoneLength, {
        message: `Phone must be a string consisting of ${phoneLength} numbers. For example: 4153245540`,
      })
      .or(defaultOptionalString),
    email: z.string().email().or(defaultOptionalString),
  })
  .refine(c => c.email || c.phone, { message: "Either email or phone must be present" });
export const patientCreateSchema = z.object({
  firstName: defaultNameString,
  lastName: defaultNameString,
  dob: defaultDateString,
  genderAtBirth: z.enum(genderAtBirthTypes),
  personalIdentifiers: z.array(personalIdentifierSchema).nullish(),
  address: z.array(addressSchema).or(addressSchema),
  contact: z.array(contactSchema).optional().or(contactSchema.optional()),
});
export type PatientCreate = z.infer<typeof patientCreateSchema>;

export const patientUpdateSchema = patientCreateSchema;
export type PatientUpdate = z.infer<typeof patientUpdateSchema>;

export function schemaCreateToPatient(input: PatientCreate, cxId: string) {
  return {
    ...input,
    cxId,
    address: Array.isArray(input.address) ? input.address : [input.address],
    contact:
      input.contact && Array.isArray(input.contact)
        ? input.contact
        : input.contact
        ? [input.contact]
        : undefined,
  };
}

export function schemaUpdateToPatient(input: PatientUpdate, cxId: string) {
  return schemaCreateToPatient(input, cxId);
}

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
  defaultString,
  parseToNumericString,
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
      .transform(phone => parseToNumericString(phone))
      .refine(phone => phone.length === phoneLength, {
        message: `Phone must be a string consisting of ${phoneLength} numbers. For example: 4153245540`,
      })
      .or(defaultOptionalString),
    email: z.string().email().or(defaultOptionalString),
  })
  .transform(contact => {
    return !contact.email && !contact.phone ? undefined : contact;
  })
  .nullish();
export const patientCreateSchema = z.object({
  firstName: defaultNameString.or(z.array(defaultString)),
  lastName: defaultNameString.or(z.array(defaultString)),
  dob: defaultDateString,
  genderAtBirth: z.enum(genderAtBirthTypes),
  personalIdentifiers: z.array(personalIdentifierSchema),
  address: z.array(addressSchema).or(addressSchema),
  contact: z.array(contactSchema).nullish().or(contactSchema),
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

import { z } from "zod";
import {
  driversLicenseType,
  genderAtBirthTypes,
  generalTypes,
} from "../../../models/medical/patient";
import { USState } from "../../../shared/geographic-locations";
import { addressSchema } from "./address";
import { baseUpdateSchema } from "./base-update";

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

export const patientCreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().length(10), // YYYY-MM-DD
  genderAtBirth: z.enum(genderAtBirthTypes),
  personalIdentifiers: z.array(personalIdentifierSchema),
  address: addressSchema,
  contact: z.object({
    phone: z.string().length(10).or(z.undefined()),
    email: z.string().email().or(z.undefined()),
  }),
});
export type PatientCreate = z.infer<typeof patientCreateSchema>;

export const patientUpdateSchema = patientCreateSchema.merge(baseUpdateSchema);
export type PatientUpdate = z.infer<typeof patientUpdateSchema>;

export function schemaToPatient(input: PatientCreate, cxId: string) {
  return {
    ...input,
    cxId,
    address: {
      ...input.address,
      addressLine2: input.address.addressLine2 ?? undefined,
    },
  };
}

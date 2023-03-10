import { z } from "zod";
import { PatientCreate as PatientCreateCmd } from "../../../command/medical/patient/create-patient";
import { PatientUpdate as PatientUpdateCmd } from "../../../command/medical/patient/update-patient";
import {
  driversLicenseType,
  genderAtBirthTypes,
  generalTypes,
} from "../../../models/medical/patient";
import { USState } from "../../../shared/geographic-locations";
import { addressSchema } from "./address";
import { optionalString } from "./shared";

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
export const personalIdentifierSchema = basePersonalIdentifierSchema
  .merge(driverLicenseIdentifierSchema)
  .or(basePersonalIdentifierSchema.merge(generalTypeIdentifierSchema));
export type PersonalIdentifier = z.infer<typeof personalIdentifierSchema>;

export const patientCreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().length(10), // YYYY-MM-DD
  genderAtBirth: z.enum(genderAtBirthTypes),
  personalIdentifiers: z.array(personalIdentifierSchema),
  address: addressSchema,
  contact: z.object({
    phone: optionalString(z.string().length(10)),
    email: optionalString(z.string().email()),
  }),
});
export type PatientCreate = z.infer<typeof patientCreateSchema>;

export const patientUpdateSchema = patientCreateSchema.extend({
  id: z.string(),
});
export type PatientUpdate = z.infer<typeof patientUpdateSchema>;

export const patientSchema = patientUpdateSchema.extend({
  facilityIds: z.array(z.string()),
});
export type Patient = z.infer<typeof patientSchema>;

function schemaToPatient(input: PatientCreate, cxId: string) {
  return {
    ...input,
    cxId,
    address: {
      ...input.address,
      addressLine2: input.address.addressLine2 ?? undefined,
    },
  };
}

export function schemaToPatientCreate(
  input: PatientCreate,
  cxId: string,
  facilityId: string
): PatientCreateCmd {
  const base = schemaToPatient(input, cxId);
  return {
    ...base,
    facilityId,
  };
}

export function schemaToPatientUpdate(input: PatientUpdate, cxId: string): PatientUpdateCmd {
  const base = schemaToPatient(input, cxId);
  return {
    ...base,
    id: input.id,
  };
}

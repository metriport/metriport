import { PatientCreate, patientCreateSchema } from "@metriport/api-sdk";
import { defaultDateString } from "./shared";

import { z } from "zod";
import { driversLicenseType, generalTypes } from "../../../domain/medical/patient";
import { USState } from "@metriport/core/domain/geographic-locations";

const usStateSchema = z.nativeEnum(USState);

export const basePersonalIdentifierSchema = z.object({
  value: z.string(),
  period: z
    .object({
      start: defaultDateString,
      end: defaultDateString.optional(),
    })
    .or(
      z.object({
        start: defaultDateString.optional(),
        end: defaultDateString,
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

import { PatientCreate, patientCreateSchema, Demographics } from "@metriport/api-sdk";
import { z } from "zod";
import { driversLicenseType, generalTypes } from "@metriport/core/domain/patient";
import { usStateSchema } from "@metriport/api-sdk/medical/models/common/us-data";

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

export function schemaDemographicsToPatient(input: Demographics, cxId: string) {
  return schemaCreateToPatient(input, cxId);
}

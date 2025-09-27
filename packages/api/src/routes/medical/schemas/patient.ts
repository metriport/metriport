import { Contact as ContactSchema, Demographics, patientCreateSchema } from "@metriport/api-sdk";
import { Contact } from "@metriport/core/domain/contact";
import { PatientData } from "@metriport/core/domain/patient";
import { z } from "zod";

export const patientUpdateSchema = patientCreateSchema;
export type PatientUpdate = z.infer<typeof patientUpdateSchema>;

export function schemaContactToContact(input: ContactSchema): Contact {
  return {
    email: input.email ?? undefined,
    phone: input.phone ?? undefined,
  };
}

export function schemaCreateToPatientData(input: Demographics): PatientData {
  return {
    ...input,
    address: Array.isArray(input.address) ? input.address : [input.address],
    contact:
      input.contact && Array.isArray(input.contact)
        ? input.contact.map(schemaContactToContact)
        : input.contact
        ? [schemaContactToContact(input.contact)]
        : undefined,
  };
}

export function schemaUpdateToPatientData(input: PatientUpdate): PatientData {
  return schemaCreateToPatientData(input);
}

export function schemaDemographicsToPatientData(input: Demographics): PatientData {
  return schemaCreateToPatientData(input);
}

export type PatientHieOptOutResponse = {
  id: string;
  hieOptOut: boolean;
  message: string;
};

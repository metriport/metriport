import {
  Contact as ContactSchema,
  Demographics,
  PatientCreate,
  patientCreateSchema,
} from "@metriport/api-sdk";
import { Contact } from "@metriport/core/domain/contact";
import { z } from "zod";
import { PatientMatchCmd } from "../../../command/medical/patient/get-patient";

export const patientUpdateSchema = patientCreateSchema;
export type PatientUpdate = z.infer<typeof patientUpdateSchema>;

export function schemaContactToContact(input: ContactSchema): Contact {
  return {
    email: input.email ?? undefined,
    phone: input.phone ?? undefined,
  };
}

export function schemaCreateToPatient(input: PatientCreate, cxId: string): PatientMatchCmd {
  return {
    ...input,
    cxId,
    address: Array.isArray(input.address) ? input.address : [input.address],
    contact:
      input.contact && Array.isArray(input.contact)
        ? input.contact.map(schemaContactToContact)
        : input.contact
        ? [schemaContactToContact(input.contact)]
        : undefined,
  };
}

export function schemaUpdateToPatient(input: PatientUpdate, cxId: string): PatientMatchCmd {
  return schemaCreateToPatient(input, cxId);
}

export function schemaDemographicsToPatient(input: Demographics, cxId: string): PatientMatchCmd {
  return schemaCreateToPatient(input, cxId);
}

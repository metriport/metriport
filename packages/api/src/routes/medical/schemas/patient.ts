import {
  Contact as ContactSchema,
  Demographics,
  PatientCreate,
  patientCreateSchema,
} from "@metriport/api-sdk";
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

export function schemaCreateToPatientData(input: PatientCreate): PatientData {
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

const coverageAssessmentPatientSchema = z.object({
  dob: z.string(),
  gender: z.string(),
  firstname: z.string(),
  lastname: z.string(),
  zip: z.string(),
  city: z.string(),
  state: z.string(),
  addressline1: z.string(),
  addressline2: z.string().optional(),
  phone1: z.string().optional(),
  phone2: z.string().optional(),
  email1: z.string().optional(),
  email2: z.string().optional(),
  externalid: z.string().optional(),
});

export const coverageAssessmentSchema = z.object({
  patients: coverageAssessmentPatientSchema.array(),
});

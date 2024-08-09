import {
  Contact as ContactSchema,
  Demographics,
  PatientCreate,
  patientCreateSchema,
} from "@metriport/api-sdk";
import {
  normalizeDateSafe,
  normalizeGenderSafe,
  isPhoneValid,
  isEmailValid,
  normalizeStateSafe,
  normalizeZipCodeSafe,
} from "@metriport/shared";
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
  dob: z.string().refine(normalizeDateSafe, { message: "Invalid dob" }),
  gender: z.string().refine(normalizeGenderSafe, { message: "Invalid gender" }),
  firstname: z.string().min(1, { message: "First name must be defined" }),
  lastname: z.string().min(1, { message: "Last name must be defined" }),
  zip: z.string().refine(normalizeZipCodeSafe, { message: "Invalid zip" }),
  city: z.string().min(1, { message: "City must be defined" }),
  state: z.string().refine(normalizeStateSafe, { message: "Invalid state" }),
  addressline1: z.string().min(1, { message: "Address line must be defined" }),
  addressline2: z.string().optional(),
  phone1: z.string().refine(isPhoneValid, { message: "Invalid phone" }).optional(),
  phone2: z.string().refine(isPhoneValid, { message: "Invalid phone" }).optional(),
  email1: z.string().refine(isEmailValid, { message: "Invalid email" }).optional(),
  email2: z.string().refine(isEmailValid, { message: "Invalid email" }).optional(),
  externalid: z.string().optional(),
});

export const coverageAssessmentSchema = z.object({
  patients: coverageAssessmentPatientSchema.array(),
});

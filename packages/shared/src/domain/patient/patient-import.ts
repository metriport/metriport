import { z } from "zod";
import { normalizeUSStateForAddressSafe } from "../address";
import { normalizeZipCodeNewSafe } from "../address/zip";
import { normalizeEmailSafe } from "../contact/email";
import { normalizePhoneNumberSafe } from "../contact/phone";
import { normalizeDobSafe } from "../dob";
import { normalizeGenderSafe } from "../gender";

export const patientImportPatientSchema = z.object({
  dob: z.string().refine(normalizeDobSafe, { message: "Invalid dob" }),
  gender: z.string().refine(normalizeGenderSafe, { message: "Invalid gender" }),
  firstname: z.string().min(1, { message: "First name must be defined" }),
  lastname: z.string().min(1, { message: "Last name must be defined" }),
  zip: z.string().refine(normalizeZipCodeNewSafe, { message: "Invalid zip" }),
  city: z.string().min(1, { message: "City must be defined" }),
  state: z
    .string()
    .refine(normalizeUSStateForAddressSafe, { message: "Invalid state or territory" }),
  addressline1: z.string().min(1, { message: "Address line must be defined" }),
  addressline2: z.string().optional(),
  phone1: z.string().refine(normalizePhoneNumberSafe, { message: "Invalid phone" }).optional(),
  phone2: z.string().refine(normalizePhoneNumberSafe, { message: "Invalid phone" }).optional(),
  email1: z.string().refine(normalizeEmailSafe, { message: "Invalid email" }).optional(),
  email2: z.string().refine(normalizeEmailSafe, { message: "Invalid email" }).optional(),
  externalid: z.string().optional(),
});
export type PatientImportPatient = z.infer<typeof patientImportPatientSchema>;

export const patientImportSchema = z.object({
  patients: patientImportPatientSchema.array(),
});

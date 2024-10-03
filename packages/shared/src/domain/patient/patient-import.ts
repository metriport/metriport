import { z } from "zod";
import { normalizeDateSafe } from "../dob";
import { normalizeGenderSafe } from "../gender";
import { normalizeZipCodeSafe } from "../address/zip";
import { normalizeStateSafe } from "../address/state";
import { isPhoneValid } from "../contact/phone";
import { isEmailValid } from "../contact/email";

export const patientImportPatientSchema = z.object({
  dob: z.string().refine(normalizeDateSafe, { message: "Invalid dob" }),
  gender: z.string().refine(normalizeGenderSafe, { message: "Invalid gender" }),
  firstname: z.string().min(1, { message: "First name must be defined" }),
  lastname: z.string().min(1, { message: "Last name must be defined" }),
  zip: z.string().refine(arg => normalizeZipCodeSafe(arg, true), { message: "Invalid zip" }),
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
export type PatientImportPatient = z.infer<typeof patientImportPatientSchema>;

export const patientImportSchema = z.object({
  patients: patientImportPatientSchema.array(),
});

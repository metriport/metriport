import { z } from "zod";
import { normalizeStringSafe } from "../../common/string";
import { normalizeDateSafe } from "../dob";
import { normalizeGenderSafe } from "../gender";
import { normalizeStateSafe } from "../address/state";
import { normalizeZipCodeSafe } from "../address/zip";
import { normalizeEmailSafe } from "../contact/email";
import { normalizePhoneSafe } from "../contact/phone";

export const patientImportPatientSchema = z.object({
  dob: z.string().refine(normalizeDateSafe, { message: "Invalid dob" }),
  gender: z.string().refine(normalizeGenderSafe, { message: "Invalid gender" }),
  firstname: z
    .string()
    .min(1, { message: "First name must be defined" })
    .refine(normalizeStringSafe, { message: "Invalid first name" }),
  lastname: z
    .string()
    .min(1, { message: "Last name must be defined" })
    .refine(normalizeStringSafe, { message: "Invalid last name" }),
  addressline1: z
    .string()
    .min(1, { message: "Address line must be defined" })
    .refine(normalizeStringSafe, { message: "Invalid adderess line" }),
  city: z
    .string()
    .min(1, { message: "City must be defined" })
    .refine(normalizeStringSafe, { message: "Invalid city" }),
  state: z.string().refine(normalizeStateSafe, { message: "Invalid state" }),
  zip: z.string().refine(arg => normalizeZipCodeSafe(arg), { message: "Invalid zip" }),
  addressline2: z.string().optional(),
  phone1: z.string().refine(normalizePhoneSafe, { message: "Invalid phone" }).optional(),
  phone2: z.string().refine(normalizePhoneSafe, { message: "Invalid phone" }).optional(),
  email1: z.string().refine(normalizeEmailSafe, { message: "Invalid email" }).optional(),
  email2: z.string().refine(normalizeEmailSafe, { message: "Invalid email" }).optional(),
  externalid: z.string().optional(),
});
export type PatientImportPatient = z.infer<typeof patientImportPatientSchema>;

export const patientImportSchema = z.object({
  patients: patientImportPatientSchema.array(),
});

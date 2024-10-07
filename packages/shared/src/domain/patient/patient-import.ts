import { z } from "zod";
import { trimAndCheckEmptySafe } from "../../common/string";
import { normalizeDateSafe } from "../dob";
import { normalizeGenderSafe } from "../gender";
import { normalizeStateSafe } from "../address/state";
import { normalizeZipCodeSafe } from "../address/zip";
import { isEmailValid } from "../contact/email";
import { isPhoneValid } from "../contact/phone";

export const patientImportPatientSchema = z.object({
  dob: z.string().refine(normalizeDateSafe, { message: "Invalid dob" }),
  gender: z.string().refine(normalizeGenderSafe, { message: "Invalid gender" }),
  firstname: z
    .string()
    .min(1, { message: "First name must be defined" })
    .refine(trimAndCheckEmptySafe, { message: "Invalid first name" }),
  lastname: z
    .string()
    .min(1, { message: "Last name must be defined" })
    .refine(trimAndCheckEmptySafe, { message: "Invalid last name" }),
  zip: z.string().refine(arg => normalizeZipCodeSafe(arg), { message: "Invalid zip" }),
  city: z
    .string()
    .min(1, { message: "City must be defined" })
    .refine(trimAndCheckEmptySafe, { message: "Invalid city" }),
  state: z.string().refine(normalizeStateSafe, { message: "Invalid state" }),
  addressline1: z
    .string()
    .min(1, { message: "Address line must be defined" })
    .refine(trimAndCheckEmptySafe, { message: "Invalid adderess line" }),
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

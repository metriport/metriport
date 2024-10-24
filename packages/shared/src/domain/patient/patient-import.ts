import { z } from "zod";
import { nonEmptyStringSchema } from "../../common/string";
import { dobSchema } from "../dob";
import { genderAtBirthSchema } from "../gender";
import { zipSchema } from "../address/zip";
import { usStateForAddressSchema } from "../address";
import { phoneSchema } from "../contact/phone";
import { emailSchema } from "../contact/email";

export const patientImportPatientSchema = z.object({
  dob: dobSchema,
  gender: genderAtBirthSchema,
  firstname: nonEmptyStringSchema,
  lastname: nonEmptyStringSchema,
  addressline1: nonEmptyStringSchema,
  addressline2: nonEmptyStringSchema.optional(),
  city: nonEmptyStringSchema,
  state: usStateForAddressSchema,
  zip: zipSchema,
  phone1: phoneSchema.optional(),
  phone2: phoneSchema.optional(),
  email1: emailSchema.optional(),
  email2: emailSchema.optional(),
  externalid: nonEmptyStringSchema.optional(),
});
export type PatientImportPatient = z.infer<typeof patientImportPatientSchema>;

export const patientImportSchema = z.object({
  patients: patientImportPatientSchema.array(),
});

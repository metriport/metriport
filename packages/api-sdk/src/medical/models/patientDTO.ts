import { z } from "zod";
import { baseUpdateSchema } from "./common/base-update";
import { defaultDateString, defaultNameString } from "../../shared";
import { contactSchema, genderAtBirthSchema, personalIdentifierSchema } from "./demographics";
import { addressSchemaDTO } from "./common/address";

const demographicsSchema = z.object({
  firstName: defaultNameString,
  lastName: defaultNameString,
  dob: defaultDateString,
  genderAtBirth: genderAtBirthSchema,
  personalIdentifiers: z.array(personalIdentifierSchema).optional(),
  address: z.array(addressSchemaDTO).or(addressSchemaDTO),
  contact: z.array(contactSchema).optional().or(contactSchema.optional()),
});

export const dtoGetPatientSchema = demographicsSchema.merge(baseUpdateSchema).extend({
  facilityIds: z.array(z.string()),
});

export const dtoListPatientSchema = z.object({
  patients: z.array(dtoGetPatientSchema),
});

export type PatientDTO = z.infer<typeof dtoGetPatientSchema>;

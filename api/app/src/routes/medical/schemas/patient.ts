import { z } from "zod";
import { USState } from "../../../shared/oid";
import { addressSchema } from "./address";
import { optionalString } from "./shared";

export const patientCreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().length(10), // YYYY-MM-DD
  // gender: z.enum(["F", "M", "UN"]), // UN = Unspecified
  driversLicense: z
    .object({
      value: z.string(),
      state: z.nativeEnum(USState),
    })
    .optional(),
  address: addressSchema,
  contact: z.object({
    phone: optionalString(z.string().length(10)),
    email: optionalString(z.string().email()),
  }),
});
export type PatientCreate = z.infer<typeof patientCreateSchema>;

export const patientUpdateSchema = patientCreateSchema.extend({
  id: z.string(),
});
export type PatientUpdate = z.infer<typeof patientUpdateSchema>;

export const patientSchema = patientUpdateSchema.extend({
  facilityIds: z.array(z.string()),
});
export type Patient = z.infer<typeof patientSchema>;

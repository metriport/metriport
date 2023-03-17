import { z } from "zod";
import { addressSchema } from "./common/address";
import { usStateSchema } from "./common/us-data";

export const basePersonalIdentifierSchema = z.object({
  value: z.string(),
  period: z
    .object({
      start: z.string(),
      end: z.string().optional(),
    })
    .or(
      z.object({
        start: z.string().optional(),
        end: z.string(),
      })
    )
    .optional(),
  assigner: z.string().optional(),
});

export const driverLicenseIdentifierSchema = z.object({
  type: z.literal("driversLicense"),
  state: usStateSchema,
});

export const personalIdentifierSchema = basePersonalIdentifierSchema.merge(
  driverLicenseIdentifierSchema
);
export type PersonalIdentifier = z.infer<typeof personalIdentifierSchema>;

export const patientCreateSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  dob: z.string(), // YYYY-MM-DD
  genderAtBirth: z.enum(["F", "M"]),
  personalIdentifiers: z.array(personalIdentifierSchema),
  address: addressSchema,
  contact: z
    .object({
      phone: z.string().length(10).or(z.undefined()),
      email: z.string().email().or(z.undefined()),
    })
    .optional(),
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

export const patientListSchema = z.object({
  patients: z.array(patientSchema),
});

import {
  examplePhoneNumber,
  exampleEmail,
  normalizePhoneSafe,
  normalizePhone,
  normalizeEmailSafe,
  normalizeEmail,
} from "@metriport/shared";
import { z } from "zod";
import { defaultDateString, defaultNameString } from "../../shared";
import { addressSchema } from "./common/address";
import { usStateSchema } from "./common/us-data";

export const generalPersonalIdentifiers = ["ssn"] as const;
export const driversLicensePersonalIdentifier = ["driversLicense"] as const;
export type GeneralPersonalIdentifiers = (typeof generalPersonalIdentifiers)[number];
export type DriversLicensePersonalIdentifier = (typeof driversLicensePersonalIdentifier)[number];

const basePersonalIdentifierSchema = z.object({
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
  type: z.enum(driversLicensePersonalIdentifier),
  state: usStateSchema,
});
export const driverLicenseIdentifierWithBaseSchema = basePersonalIdentifierSchema.merge(
  driverLicenseIdentifierSchema
);
export type DriverLicenseIdentifier = z.infer<typeof driverLicenseIdentifierWithBaseSchema>;

export const generalTypeIdentifierSchema = z.object({
  type: z.enum(generalPersonalIdentifiers),
});
export const generalTypeIdentifierWithBaseSchema = basePersonalIdentifierSchema.merge(
  generalTypeIdentifierSchema
);
export type GeneralTypeIdentifier = z.infer<typeof generalTypeIdentifierWithBaseSchema>;

export const personalIdentifierSchema = driverLicenseIdentifierWithBaseSchema.or(
  generalTypeIdentifierWithBaseSchema
);
export type PersonalIdentifier = z.infer<typeof personalIdentifierSchema>;

export const genderAtBirthSchema = z.enum(["F", "M", "O", "U"]);

export const contactSchema = z
  .object({
    phone: z.coerce
      .string()
      .refine(normalizePhoneSafe, {
        message: `Phone is invalid. For example: ${examplePhoneNumber}`,
      })
      .transform(normalizePhone)
      .or(z.null())
      .or(z.undefined()),
    email: z.coerce
      .string()
      .refine(normalizeEmailSafe, {
        message: `Email is invalid. For example: ${exampleEmail}`,
      })
      .transform(normalizeEmail)
      .or(z.null())
      .or(z.undefined()),
  })
  .refine(c => c.email || c.phone, { message: "Either email or phone must be present" });
export type Contact = z.infer<typeof contactSchema>;

export const demographicsSchema = z.object({
  firstName: defaultNameString,
  lastName: defaultNameString,
  dob: defaultDateString,
  genderAtBirth: genderAtBirthSchema,
  personalIdentifiers: z.array(personalIdentifierSchema).optional(),
  address: z.array(addressSchema).nonempty().or(addressSchema),
  contact: z.array(contactSchema).optional().or(contactSchema.optional()),
});

export type Demographics = z.infer<typeof demographicsSchema>;

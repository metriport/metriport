import { z } from "zod";
import { addressSchema } from "./common/address";
import { usStateSchema } from "./common/us-data";
import {
  defaultDateString,
  defaultNameString,
  defaultOptionalString,
  stripNonNumericChars,
} from "../../shared";

export const generalPersonalIdentifiers = ["passport", "ssn", "medicare"] as const;
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

export const generalTypeIdentifierSchema = z.object({
  type: z.enum(generalPersonalIdentifiers),
});

export const personalIdentifierSchema = basePersonalIdentifierSchema
  .merge(driverLicenseIdentifierSchema)
  .or(basePersonalIdentifierSchema.merge(generalTypeIdentifierSchema));
export type PersonalIdentifier = z.infer<typeof personalIdentifierSchema>;

export const genderAtBirthSchema = z.enum(["F", "M"]);

const phoneLength = 10;
export const contactSchema = z
  .object({
    phone: z.coerce
      .string()
      .transform(phone => stripNonNumericChars(phone))
      .refine(phone => phone.length === phoneLength, {
        message: `Phone must be a string consisting of ${phoneLength} numbers. For example: 4153245540`,
      })
      .or(defaultOptionalString),
    email: z.string().email().or(defaultOptionalString),
  })
  .refine(c => c.email || c.phone, { message: "Either email or phone must be present" });

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

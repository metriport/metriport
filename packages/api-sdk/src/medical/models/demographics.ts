import { z } from "zod";
import { addressSchema } from "./common/address";
import { usStateSchema } from "./common/us-data";
import {
  defaultDateString,
  defaultNameString,
  defaultOptionalString,
  stripNonNumericChars,
} from "../../shared";

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
  type: z.literal("driversLicense"), // If another type is added, the UI forms for patient creation/updates will need to be updated to support these types
  state: usStateSchema,
});

export const personalIdentifierSchema = basePersonalIdentifierSchema.merge(
  driverLicenseIdentifierSchema
);
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
  address: z.array(addressSchema).or(addressSchema),
  contact: z.array(contactSchema).optional().or(contactSchema.optional()),
});

export type Demographics = z.infer<typeof demographicsSchema>;

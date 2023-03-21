import { z } from "zod";
import { addressSchema } from "./common/address";
import { usStateSchema } from "./common/us-data";

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
  type: z.literal("driversLicense"),
  state: usStateSchema,
});

export const personalIdentifierSchema = basePersonalIdentifierSchema.merge(
  driverLicenseIdentifierSchema
);
export type PersonalIdentifier = z.infer<typeof personalIdentifierSchema>;

export const genderAtBirthSchema = z.enum(["F", "M"]);

export const contactSchema = z.object({
  phone: z.string().length(10).or(z.undefined()),
  email: z.string().email().or(z.undefined()),
});

export const demographicsSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  dob: z.string(), // YYYY-MM-DD
  genderAtBirth: genderAtBirthSchema,
  personalIdentifiers: z.array(personalIdentifierSchema),
  address: addressSchema,
  contact: contactSchema.optional(),
});
export type Demographics = z.infer<typeof demographicsSchema>;

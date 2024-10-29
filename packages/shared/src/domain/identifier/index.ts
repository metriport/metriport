import { z } from "zod";
import { createNonEmptryStringSchema } from "../../common/string";
import { isValidISODate } from "../../common/date";
import { usStateSchema } from "../address/state";

export const generalPersonalIdentifiers = ["ssn"] as const;
export const driversLicensePersonalIdentifier = ["driversLicense"] as const;
export type GeneralPersonalIdentifiers = (typeof generalPersonalIdentifiers)[number];
export type DriversLicensePersonalIdentifier = (typeof driversLicensePersonalIdentifier)[number];

export const periodDateSchema = z.string().refine(isValidISODate, {
  message: "Invalid period date",
});

const baseIdentifierSchema = z.object({
  value: createNonEmptryStringSchema("value"),
  period: z
    .object({
      start: periodDateSchema,
      end: periodDateSchema.optional(),
    })
    .or(
      z.object({
        start: periodDateSchema.optional(),
        end: periodDateSchema,
      })
    )
    .optional(),
  assigner: createNonEmptryStringSchema("assigner").optional(),
});

export const driverLicenseSchema = z.object({
  type: z.enum(driversLicensePersonalIdentifier),
  state: usStateSchema,
});
export const driverLicenseWithBaseSchema = baseIdentifierSchema.merge(driverLicenseSchema);

export const generalIdentifierSchema = z.object({
  type: z.enum(generalPersonalIdentifiers),
});
export const generalIdentifierWithBaseSchema = baseIdentifierSchema.merge(generalIdentifierSchema);

export const personalIdentifierSchema = driverLicenseWithBaseSchema.or(
  generalIdentifierWithBaseSchema
);

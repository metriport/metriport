import { z } from "zod";
import {
  demographicsSchema as demographicsSchemaShared,
  contactSchema as contactSchemaShared,
  personalIdentifierSchema as personalIdentifierSchemaShared,
  generalPersonalIdentifiers as generalPersonalIdentifiersShared,
  driverLicenseSchema as driverLicenseSchemaShared,
  genderAtBirthSchema as genderAtBirthSchemaShared,
} from "@metriport/shared";

export const demographicsSchema = demographicsSchemaShared;
export type Demographics = z.infer<typeof demographicsSchema>;

export const contactSchema = contactSchemaShared;
export type Contact = z.infer<typeof contactSchema>;

export const personalIdentifierSchema = personalIdentifierSchemaShared;
export type PersonalIdentifier = z.infer<typeof personalIdentifierSchema>;

export const generalPersonalIdentifiers = generalPersonalIdentifiersShared;
export type GeneralTypeIdentifier = z.infer<typeof generalPersonalIdentifiers>;

export const driversLicensePersonalIdentifier = driverLicenseSchemaShared;
export type DriverLicenseIdentifier = z.infer<typeof driversLicensePersonalIdentifier>;

export const genderAtBirthSchema = genderAtBirthSchemaShared;

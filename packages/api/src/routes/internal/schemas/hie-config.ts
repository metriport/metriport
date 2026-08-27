import { USState } from "@metriport/shared";
import { z } from "zod";

/**
 * WARNING Updating this schema requires updating file: @metriport/packages/infra/config/hl7-notification-config.ts
 */
const hieIanaTimezoneSchema = z.enum([
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
]);

const hl7v2SubscriptionSchema = z.enum(["adt"]);

const hieSftpConfigSchema = z.object({
  host: z.string(),
  port: z.number(),
  username: z.string(),
  logLevel: z.enum(["info", "debug", "none"]).optional(),
  remotePath: z.string(),
});

const rosterRowDataKeys = [
  "id",
  "cxId",
  "rosterGenerationDate",
  "firstName",
  "lastName",
  "dob",
  "dobNoDelimiter",
  "dobMonthDayYear",
  "middleName",
  "genderAtBirth",
  "genderOtherAsUnknown",
  "genderOneTwoAndNine",
  "scrambledId",
  "patientExternalId",
  "ssn",
  "driversLicense",
  "phone",
  "email",
  "address1AddressLine1",
  "address1AddressLine2",
  "address1SingleLine",
  "address1City",
  "address1State",
  "address1Zip",
  "address1ZipPlus4",
  "insuranceId",
  "insuranceCompanyId",
  "insuranceCompanyName",
  "cxShortcode",
  "authorizingParticipantMrn",
  "assigningAuthorityIdentifier",
  "lineOfBusiness",
  "dateTwoMonthsInFutureNoDelimiter",
  "dateMid2025NoDelimiter",
  "emptyString",
  "addAllCaps",
  "address1AddressLine1SplitByTabAddress1",
  "address1AddressLine1SplitByTabAddress2",
  "firstNameWithNoNicknames",
  "firstNameWithNoSpecialCharacters",
  "lastNameWithNoSpecialCharacters",
] as const;

const hiePatientRosterMappingSchema = z.record(z.string(), z.enum(rosterRowDataKeys));

const baseHieConfigSchema = z.object({
  name: z.string(),
  timezone: hieIanaTimezoneSchema,
  states: z.array(z.nativeEnum(USState)),
  subscriptions: z.array(hl7v2SubscriptionSchema),
  checklyPingUrl: z.string().optional(),
  cron: z.string(),
  sftpConfig: hieSftpConfigSchema,
  mapping: hiePatientRosterMappingSchema,
});

export const hieConfigSchema = baseHieConfigSchema.extend({
  gatewayPublicIp: z.string(),
  internalCidrBlocks: z.array(z.string()),
});

export const vpnlessHieConfigSchema = baseHieConfigSchema;

export const hieConfigOrVpnlessSchema = z.union([hieConfigSchema, vpnlessHieConfigSchema]);

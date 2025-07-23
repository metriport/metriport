import { z } from "zod";
import { Config } from "../../util/config";

const cidrBlockRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;

export const hieIanaTimezoneSchema = z.enum([
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
]);

export type HieIanaTimezone = z.infer<typeof hieIanaTimezoneSchema>;

/**
 * The schema for the HIE config dictionary that passes our integrated HIEs
 * to OSS services at runtime.
 *
 * Search HIE_CONFIG_DICTIONARY to find all the places where this dictionary is
 * loaded as an environment variable in our infra.
 */
export const hieConfigDictionarySchema = z.record(
  z.string(),
  z.union([
    // Schema for a normal Vpn based HIE config
    z.object({
      cidrBlock: z.string().regex(cidrBlockRegex, {
        message: "Must be a valid CIDR block (e.g., '10.0.0.0/16')",
      }),
      timezone: hieIanaTimezoneSchema,
    }),
    // Schema for a HIE config that doesn't have a VPN
    z.object({
      timezone: hieIanaTimezoneSchema,
    }),
  ])
);

export type HieConfigDictionary = z.infer<typeof hieConfigDictionarySchema>;

export function getHieConfigDictionary(): HieConfigDictionary {
  return hieConfigDictionarySchema.parse(Config.getHieConfigDictionary());
}

export function getHieNames(): string[] {
  return Object.keys(getHieConfigDictionary());
}

export function throwOnInvalidHieName(name: string): string {
  const hieNameSchema = z.enum(getHieNames() as [string, ...string[]]);
  return hieNameSchema.parse(name);
}

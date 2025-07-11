import { z } from "zod";
import { Config } from "../../util/config";

export const hieIANATimezoneSchema = z.enum([
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
]);

export type HieIANATimezone = z.infer<typeof hieIANATimezoneSchema>;

export const hieConfigDictionarySchema = z.record(
  z.string(),
  z.object({
    cidrBlock: z.string(), // e.g. "10.0.0.0/16"
    timezone: hieIANATimezoneSchema,
  })
);

export type HieConfigDictionary = z.infer<typeof hieConfigDictionarySchema>;

export function getHieConfigDictionary(): HieConfigDictionary {
  return hieConfigDictionarySchema.parse(Config.getHieConfigDictionary());
}

import { z } from "zod";
import { Config } from "../../util/config";

export const hieTimezoneDictionarySchema = z.record(
  z.string(),
  z.object({
    cidrBlock: z.string(), // e.g. "10.0.0.0/16"
    timezone: z.string(), // e.g. "America/New_York"
  })
);

export type HieTimezoneDictionary = z.infer<typeof hieTimezoneDictionarySchema>;

export function getHieTimezoneDictionary(): HieTimezoneDictionary {
  return hieTimezoneDictionarySchema.parse(Config.getHieTimezoneDictionary());
}

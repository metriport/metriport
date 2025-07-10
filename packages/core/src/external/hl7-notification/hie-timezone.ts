import { z } from "zod";

export const hieTimezoneDictionarySchema = z.record(
  z.string(),
  z.object({
    cidrBlock: z.string(), // e.g. "10.0.0.0/16"
    timezone: z.string(), // e.g. "America/New_York"
  })
);

export type HieTimezoneDictionary = z.infer<typeof hieTimezoneDictionarySchema>;

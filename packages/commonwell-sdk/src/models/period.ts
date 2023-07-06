import { z } from "zod";
import { isoDateSchema } from "./iso-date";
import { isoDateTimeSchema } from "./iso-datetime";

// A time period defined by a start and end time.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.12 Period)
export const periodSchema = z.object({
  start: isoDateTimeSchema.or(isoDateSchema).optional(),
  end: isoDateTimeSchema.or(isoDateSchema).optional(),
});

export type Period = z.infer<typeof periodSchema>;

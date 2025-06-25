import { optionalStringPreprocess } from "@metriport/shared/util/zod";
import { z } from "zod";
import { isoDateSchema } from "./iso-date";
import { isoDateTimeSchema } from "./iso-datetime";

// A time period defined by a start and end time.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.12 Period)
export const periodSchema = z.object({
  start: optionalStringPreprocess(isoDateTimeSchema.or(isoDateSchema).nullish()),
  end: optionalStringPreprocess(isoDateTimeSchema.or(isoDateSchema).nullish()),
});

export type Period = z.infer<typeof periodSchema>;

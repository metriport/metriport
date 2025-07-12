import { z } from "zod";
import { emptyStringToUndefinedSchema } from "../common/zod";
import { isoDateSchema, isoDateTimeSchema } from "./date";

// A time period defined by a start and end time.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.12 Period)
export const periodSchema = z.object({
  start: emptyStringToUndefinedSchema.pipe(isoDateTimeSchema.or(isoDateSchema).nullish()),
  end: emptyStringToUndefinedSchema.pipe(isoDateTimeSchema.or(isoDateSchema).nullish()),
});

export type Period = z.infer<typeof periodSchema>;

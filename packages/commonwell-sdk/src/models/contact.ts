import { z } from "zod";
import { emptyStringToUndefinedSchema } from "../common/zod";
import { periodSchema } from "./period";

// A variety of technology-mediated contact details for a person or organization, including
// telephone, email, etc.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.7 Contact)
export const contactSchema = z.object({
  value: z.string().nullish(),
  system: emptyStringToUndefinedSchema.pipe(z.string().nullish()),
  use: emptyStringToUndefinedSchema.pipe(z.string().nullish()),
  period: periodSchema.nullish(),
});
export type Contact = z.infer<typeof contactSchema>;

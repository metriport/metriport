import { z } from "zod";
import { periodSchema } from "./period";

// The value set definition for use of a human name. This value set defines its own
// terms in the system http://hl7.org/fhir/R4/valueset-name-use.html.
// See https://specification.commonwellalliance.org/appendix/terminology-bindings#c9-name-use-codes
export enum NameUseCodes {
  usual = "usual",
  official = "official",
  temp = "temp",
  nickname = "nickname",
  anonymous = "anonymous",
  old = "old",
  maiden = "maiden",
  unspecified = "unspecified",
}
export const nameUseCodesSchema = z.enum(Object.keys(NameUseCodes) as [string, ...string[]]);

// A name of a Person with text, parts and usage information.
// Names may be changed or repudiated. People may have different names in different contexts.
// Names may be divided into parts of different type that have variable significance
// depending on context, though the division into parts does not always matter. With personal
// names, the different parts may or may not be imbued with some implicit meaning; various
// cultures associate different importance with the name parts and the degree to which systems
// must care about name parts around the world varies widely.
//
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.10 HumanName)
export const humanNameSchema = z.object({
  use: nameUseCodesSchema.optional().nullable(),
  text: z.string().optional().nullable(),
  family: z.array(z.string()),
  given: z.array(z.string()).optional(),
  prefix: z.string().or(z.array(z.string())).optional().nullable(),
  suffix: z.string().or(z.array(z.string())).optional().nullable(),
  period: periodSchema.optional().nullable(),
});

export type HumanName = z.infer<typeof humanNameSchema>;

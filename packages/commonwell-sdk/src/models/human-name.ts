import { zodToLowerCase } from "@metriport/shared/util/zod";
import { z } from "zod";
import {
  emptyStringToUndefined,
  emptyStringToUndefinedSchema,
  literalStringToUndefined,
} from "../common/zod";
import { periodSchema } from "./period";

/**
 * The value set definition for use of a human name.
 * @see https://hl7.org/fhir/R4/valueset-name-use.html
 */
export enum NameUseCodes {
  usual = "usual",
  official = "official",
  temp = "temp",
  nickname = "nickname",
  anonymous = "anonymous",
  old = "old",
  maiden = "maiden",
}
export const nameUseCodesSchema = z.preprocess(zodToLowerCase, z.nativeEnum(NameUseCodes));

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
  given: z.array(z.string()),
  family: z.array(z.string()),
  prefix: z.preprocess(
    emptyStringToUndefined,
    z.string().or(z.array(z.string().nullish())).nullish()
  ),
  suffix: z.preprocess(
    emptyStringToUndefined,
    z.string().or(z.array(z.string().nullish())).nullish()
  ),
  use: emptyStringToUndefinedSchema.pipe(
    z.preprocess(literalStringToUndefined, nameUseCodesSchema.nullish())
  ),
  period: periodSchema.nullish(),
  text: z.string().nullish(),
});
export type HumanName = z.infer<typeof humanNameSchema>;

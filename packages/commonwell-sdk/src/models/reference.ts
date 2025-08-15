import { z } from "zod";
import { identifierSchema } from "./identifier";

export const referenceSchema = z.object({
  reference: z.string().nullish(),
  type: z.string().nullish(),
  identifier: identifierSchema.nullish(),
  display: z.string().nullish(),
});

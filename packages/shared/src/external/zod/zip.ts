import { z } from "zod";
import { stripNonNumericChars } from "../../common/string";

const zipLength = 5;
export const defaultZipStringSchema = z.coerce
  .string()
  .transform(zipStr => stripNonNumericChars(zipStr))
  .refine(zip => zip.length === zipLength, {
    message: `Zip must be a string consisting of ${zipLength} numbers`,
  });

import { progressSchema } from "@metriport/api/lib/medical/models/document";
import { z } from "zod";

export const documentQueryProgressSchema = z.object({
  download: progressSchema.optional(),
  convert: progressSchema.optional(),
});

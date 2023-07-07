import { progressSchema } from "@metriport/api/dist/medical/models/document";
import { z } from "zod";

export const documentQueryProgressSchema = z.object({
  download: progressSchema.optional(),
  convert: progressSchema.optional(),
});

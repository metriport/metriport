import { progressSchema } from "@metriport/api-sdk/medical/models/document";
import { z } from "zod";

export const documentQueryProgressSchema = z.object({
  download: progressSchema.optional(),
  convert: progressSchema.optional(),
});

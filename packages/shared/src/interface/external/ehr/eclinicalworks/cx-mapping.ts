import { z } from "zod";
import { documentQueryWebhookFiltersSchema, writeBackFiltersSchema } from "../shared";

export const eclinicalworksSecondaryMappingsSchema = z
  .object({})
  .merge(writeBackFiltersSchema)
  .merge(documentQueryWebhookFiltersSchema);
export type EClinicalWorksSecondaryMappings = z.infer<typeof eclinicalworksSecondaryMappingsSchema>;

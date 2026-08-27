import { z } from "zod";
import { documentQueryWebhookFiltersSchema, writeBackFiltersSchema } from "../shared";

export const salesforceSecondaryMappingsSchema = z
  .object({})
  .merge(writeBackFiltersSchema)
  .merge(documentQueryWebhookFiltersSchema);
export type SalesforceSecondaryMappings = z.infer<typeof salesforceSecondaryMappingsSchema>;

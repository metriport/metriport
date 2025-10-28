import { z } from "zod";
import { writeBackFiltersSchema } from "../shared";

export const canvasSecondaryMappingsSchema = z
  .object({
    webhookPatientPatientLinkingDisabled: z.boolean().optional(),
    webhookPatientPatientProcessingEnabled: z.boolean().optional(),
  })
  .merge(writeBackFiltersSchema)
  .optional();
export type CanavsSecondaryMappings = z.infer<typeof canvasSecondaryMappingsSchema>;

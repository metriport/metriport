import { surescriptsRosterTypeSchema } from "@metriport/shared/interface/external/surescripts/roster";
import { z } from "zod";

export const surescriptsRosterRequestSchema = z.object({
  rosterType: surescriptsRosterTypeSchema,
  cxId: z.string(),
  rosterId: z.string().optional(),
  includeMultipleDemographics: z.boolean().optional(),
  includeAugmentationDemographics: z.boolean().optional(),
});

export type SurescriptsRosterRequest = z.infer<typeof surescriptsRosterRequestSchema>;

export interface SurescriptsUploadRosterHandler {
  uploadRoster(request: SurescriptsRosterRequest): Promise<void>;
}

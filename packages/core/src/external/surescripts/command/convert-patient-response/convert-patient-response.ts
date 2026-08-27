import { surescriptsRosterTypeSchema } from "@metriport/shared/interface/external/surescripts/roster";
import { z } from "zod";

export const surescriptsPatientResponseSchema = z.object({
  cxId: z.string(),
  transmissionId: z.string(),
  populationId: z.string(),
  patientId: z.string(),
  rosterType: surescriptsRosterTypeSchema,
});

export type SurescriptsPatientResponse = z.infer<typeof surescriptsPatientResponseSchema>;

export interface SurescriptsConvertPatientResponseHandler {
  convertPatientResponse(response: SurescriptsPatientResponse): Promise<void>;
}

import { questRosterTypeSchema } from "@metriport/shared/interface/external/quest/roster";
import { z } from "zod";

export const questPatientResponseSchema = z.object({
  externalId: z.string(),
  dateId: z.string(),
  rosterType: questRosterTypeSchema,
});

export type QuestPatientResponse = z.infer<typeof questPatientResponseSchema>;

export interface QuestConvertPatientResponseHandler {
  convertQuestPatientResponse(response: QuestPatientResponse): Promise<void>;
}

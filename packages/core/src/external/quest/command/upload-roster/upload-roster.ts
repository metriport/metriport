import { questRosterTypeSchema } from "@metriport/shared/interface/external/quest/roster";
import { z } from "zod";

export const questRosterRequestSchema = z.object({
  rosterType: questRosterTypeSchema,
  cxId: z.string().optional(),
  rosterId: z.string().optional(),
});

export type QuestRosterRequest = z.infer<typeof questRosterRequestSchema>;

export interface QuestUploadRosterHandler {
  uploadRoster(request: QuestRosterRequest): Promise<void>;
}

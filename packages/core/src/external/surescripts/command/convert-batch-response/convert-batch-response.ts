import { z } from "zod";

export const surescriptsBatchResponseSchema = z.object({
  cxId: z.string(),
  transmissionId: z.string(),
  populationId: z.string(),
});

export type SurescriptsBatchResponse = z.infer<typeof surescriptsBatchResponseSchema>;

export interface SurescriptsConvertBatchResponseHandler {
  convertBatchResponse(response: SurescriptsBatchResponse): Promise<void>;
}

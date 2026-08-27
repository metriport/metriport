export type QuestIngestAllResponsesParams = {
  fileNameOverrides?: string[];
};

export interface QuestIngestAllResponsesHandler {
  ingestAllResponses(params?: QuestIngestAllResponsesParams): Promise<void>;
}

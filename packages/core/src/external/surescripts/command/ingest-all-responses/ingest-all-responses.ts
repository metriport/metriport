export type SurescriptsIngestAllResponsesParams = {
  fileNameOverrides?: string[];
};

export interface SurescriptsIngestAllResponsesHandler {
  ingestAllResponses(params?: SurescriptsIngestAllResponsesParams): Promise<void>;
}

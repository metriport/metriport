import { QuestSourceDocument, QuestResponseFile } from "../../types";

export interface QuestCreateSourceDocumentsHandler {
  createSourceDocuments(responseFiles: QuestResponseFile[]): Promise<QuestSourceDocument[]>;
}

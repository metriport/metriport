import { QuestPatientResponseFile, QuestResponseFile } from "../../types";

export interface QuestCreateSourceDocumentsHandler {
  createSourceDocuments(responseFiles: QuestResponseFile[]): Promise<QuestPatientResponseFile[]>;
}

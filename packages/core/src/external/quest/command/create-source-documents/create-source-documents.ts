import { QuestPatientResponseFile, QuestResponseFile } from "../../types";

export interface CreateSourceDocumentsHandler {
  createSourceDocuments(responseFiles: QuestResponseFile[]): Promise<QuestPatientResponseFile[]>;
}

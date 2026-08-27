import { StartDocumentQueryParams } from "../api/start-document-query";

export type DocumentQueryStarterRequest = StartDocumentQueryParams;

export interface DocumentQueryStarter {
  startDocumentQueries(requests: DocumentQueryStarterRequest[]): Promise<void>;
}

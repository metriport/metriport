import { DocumentRetrievalResponseIncoming } from "@metriport/ihe-gateway-sdk";
import { DocumentRetrievalResultModel } from "../../../../models/medical/document-retrieval-result";
import { DefaultPayload } from "./shared";

export type CreateDocumentRetrievalPayload = {
  defaultPayload: DefaultPayload;
  status: string;
  response: DocumentRetrievalResponseIncoming;
};

export async function createDocumentRetrievalResult(
  payload: CreateDocumentRetrievalPayload
): Promise<DocumentRetrievalResultModel> {
  return await DocumentRetrievalResultModel.create({
    ...payload.defaultPayload,
    status: payload.status,
    data: payload.response,
  });
}

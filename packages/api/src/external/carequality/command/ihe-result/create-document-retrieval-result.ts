import { DocumentRetrievalRespFromExternalGW } from "@metriport/ihe-gateway-sdk";
import { DocumentRetrievalResultModel } from "../../models/document-retrieval-result";
import { DefaultPayload } from "./shared";

export type CreateDocumentRetrievalPayload = {
  defaultPayload: DefaultPayload;
  status: string;
  response: DocumentRetrievalRespFromExternalGW;
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

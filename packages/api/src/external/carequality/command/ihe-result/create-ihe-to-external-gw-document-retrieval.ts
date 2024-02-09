import { DocumentRetrievalRespFromExternalGW } from "@metriport/ihe-gateway-sdk";
import { IHEToExternalGwDocumentRetrievalModel } from "../../models/ihe-to-external-gw-document-retrieval";
import { DefaultPayload } from "./shared";

export type CreateDocumentRetrievalPayload = {
  defaultPayload: DefaultPayload;
  status: string;
  response: DocumentRetrievalRespFromExternalGW;
};

export async function createIHEToExternalGwDocumentRetrieval(
  payload: CreateDocumentRetrievalPayload
): Promise<IHEToExternalGwDocumentRetrievalModel> {
  return await IHEToExternalGwDocumentRetrievalModel.create({
    ...payload.defaultPayload,
    status: payload.status,
    data: payload.response,
  });
}

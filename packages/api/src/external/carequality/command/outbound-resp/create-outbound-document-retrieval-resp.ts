import { OutboundDocumentRetrievalResp } from "@metriport/ihe-gateway-sdk";
import { OutboundDocumentRetrievalRespModel } from "../../models/outbound-document-retrieval-resp";
import { DefaultPayload } from "./shared";

export type CreateDocumentRetrievalRespPayload = {
  defaultPayload: DefaultPayload;
  status: string;
  response: OutboundDocumentRetrievalResp;
};

export async function createOutboundDocumentRetrievalResp(
  payload: CreateDocumentRetrievalRespPayload
): Promise<OutboundDocumentRetrievalRespModel> {
  return await OutboundDocumentRetrievalRespModel.create({
    ...payload.defaultPayload,
    status: payload.status,
    data: payload.response,
  });
}

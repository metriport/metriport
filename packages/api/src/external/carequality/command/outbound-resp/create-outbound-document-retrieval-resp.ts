import { OutboundDocumentRetrievalResp } from "@metriport/ihe-gateway-sdk";
import { OutboundDocumentRetrievalRespModel } from "../../models/outbound-document-retrieval-resp";
import { DefaultPayload } from "./shared";

export type CreateDocumentRetrievalRespParam = DefaultPayload & {
  status: string;
  response: OutboundDocumentRetrievalResp;
};

export async function createOutboundDocumentRetrievalResp(
  payload: CreateDocumentRetrievalRespParam
): Promise<OutboundDocumentRetrievalRespModel> {
  return await OutboundDocumentRetrievalRespModel.create({
    id: payload.id,
    requestId: payload.requestId,
    patientId: payload.patientId,
    status: payload.status,
    data: payload.response,
  });
}

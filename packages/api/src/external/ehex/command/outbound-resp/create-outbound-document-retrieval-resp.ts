import { OutboundDocumentRetrievalResp } from "@metriport/ihe-gateway-sdk";
import { EhexOutboundDocumentRetrievalRespModel } from "../../models/outbound-document-retrieval-resp";
import { DefaultPayload } from "./shared";
import { EhexOutboundDocumentRetrievalResp } from "../../models/interfaces";

export type CreateDocumentRetrievalRespParam = DefaultPayload & {
  status: string;
  response: OutboundDocumentRetrievalResp;
};

export async function createOutboundDocumentRetrievalResp(
  payload: CreateDocumentRetrievalRespParam
): Promise<EhexOutboundDocumentRetrievalResp> {
  const drRespModel = await EhexOutboundDocumentRetrievalRespModel.create({
    id: payload.id,
    requestId: payload.requestId,
    patientId: payload.patientId,
    status: payload.status,
    data: payload.response,
  });
  return drRespModel.dataValues;
}

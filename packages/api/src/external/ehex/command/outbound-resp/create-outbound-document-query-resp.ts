import { OutboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { EhexOutboundDocumentQueryRespModel } from "../../models/outbound-document-query-resp";
import { DefaultPayload } from "./shared";
import { EhexOutboundDocumentQueryResp } from "../../models/interfaces";

export type CreateDocumentQueryRespParam = DefaultPayload & {
  status: string;
  response: OutboundDocumentQueryResp;
};

export async function createOutboundDocumentQueryResp(
  payload: CreateDocumentQueryRespParam
): Promise<EhexOutboundDocumentQueryResp> {
  const dqRespModel = await EhexOutboundDocumentQueryRespModel.create({
    id: payload.id,
    requestId: payload.requestId,
    patientId: payload.patientId,
    status: payload.status,
    data: payload.response,
  });

  return dqRespModel.dataValues;
}

import { OutboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { OutboundDocumentQueryRespModel } from "../../models/outbound-document-query-resp";
import { DefaultPayload } from "./shared";

export type CreateDocumentQueryRespPayload = {
  defaultPayload: DefaultPayload;
  status: string;
  response: OutboundDocumentQueryResp;
};

export async function createOutboundDocumentQueryResp(
  payload: CreateDocumentQueryRespPayload
): Promise<OutboundDocumentQueryRespModel> {
  return await OutboundDocumentQueryRespModel.create({
    ...payload.defaultPayload,
    status: payload.status,
    data: payload.response,
  });
}

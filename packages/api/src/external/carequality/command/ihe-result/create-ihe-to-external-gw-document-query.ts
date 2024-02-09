import { DocumentQueryRespFromExternalGW } from "@metriport/ihe-gateway-sdk";
import { IHEToExternalGwDocumentQueryModel } from "../../models/ihe-to-external-gw-document-query";
import { DefaultPayload } from "./shared";

export type CreateDocumentQueryPayload = {
  defaultPayload: DefaultPayload;
  status: string;
  response: DocumentQueryRespFromExternalGW;
};

export async function createIHEToExternalGwDocumentQuery(
  payload: CreateDocumentQueryPayload
): Promise<IHEToExternalGwDocumentQueryModel> {
  return await IHEToExternalGwDocumentQueryModel.create({
    ...payload.defaultPayload,
    status: payload.status,
    data: payload.response,
  });
}

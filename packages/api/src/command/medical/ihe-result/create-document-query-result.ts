import { DocumentQueryResponseIncoming } from "@metriport/ihe-gateway-sdk";
import { DocumentQueryResultModel } from "../../../models/medical/document-query-result";
import { DefaultPayload } from "./shared";

export async function createDocumentQueryResult(
  defaultPayload: DefaultPayload,
  status: string,
  response: DocumentQueryResponseIncoming
): Promise<void> {
  await DocumentQueryResultModel.create({
    ...defaultPayload,
    status,
    data: response,
  });
}

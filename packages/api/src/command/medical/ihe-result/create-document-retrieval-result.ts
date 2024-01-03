import { DocumentRetrievalResponseIncoming } from "@metriport/ihe-gateway-sdk";
import { DocumentRetrievalResultModel } from "../../../models/medical/document-retrieval-result";
import { DefaultPayload } from "./shared";

export async function createDocumentRetrievalResult(
  defaultPayload: DefaultPayload,
  status: string,
  response: DocumentRetrievalResponseIncoming
): Promise<void> {
  await DocumentRetrievalResultModel.create({
    ...defaultPayload,
    status,
    data: response,
  });
}

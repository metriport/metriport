import {
  DocumentRetrievalRequestIncoming,
  DocumentRetrievalResponseOutgoing,
} from "@metriport/ihe-gateway-sdk";
import { validateDR } from "./validating-dr";
import { IHEGatewayError, constructDRErrorResponse, XDSRegistryError } from "../error";

export async function processIncomingRequest(
  payload: DocumentRetrievalRequestIncoming
): Promise<DocumentRetrievalResponseOutgoing> {
  try {
    // validate incoming request + look for patient and get all their documents from s3
    const documents = await validateDR(payload);

    // construct response
    const response: DocumentRetrievalResponseOutgoing = {
      id: payload.id,
      timestamp: payload.timestamp,
      responseTimestamp: new Date().toISOString(),
      documentReference: documents,
    };

    return response;
  } catch (error) {
    if (error instanceof IHEGatewayError) {
      return constructDRErrorResponse(payload, error);
    } else {
      return constructDRErrorResponse(payload, new XDSRegistryError("Internal Server Error"));
    }
  }
}

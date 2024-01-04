import {
  DocumentRetrievalRequestIncoming,
  DocumentRetrievalResponseOutgoing,
} from "@metriport/ihe-gateway-sdk";
import { validateDR } from "./validating-dr";

function constructErrorResponse(
  payload: DocumentRetrievalRequestIncoming,
  codingSystem: string,
  code: string,
  error: string
): DocumentRetrievalResponseOutgoing {
  return {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    operationOutcome: {
      resourceType: "OperationOutcome",
      id: payload.id,
      issue: [
        {
          severity: "error",
          code: "processing",
          details: {
            coding: [{ system: codingSystem, code: code }],
            text: error,
          },
        },
      ],
    },
  };
}

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    switch (error.constructor) {
      default:
        return constructErrorResponse(
          payload,
          "1.3.6.1.4.1.19376.1.2.27.3",
          "Internal Server Error",
          "Unknown Error: Contact Metriport Support for assistance"
        );
    }
  }
}

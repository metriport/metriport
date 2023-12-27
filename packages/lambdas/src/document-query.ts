import * as Sentry from "@sentry/serverless";
import {
  DocumentQueryResponseOutgoing,
  DocumentQueryRequestIncoming,
  DocumentReference,
} from "@metriport/ihe-gateway-sdk";

export const handler = Sentry.AWSLambda.wrapHandler(processRequest);

// Function to extract necessary fields and construct the responses.
async function processRequest(
  payload: DocumentQueryRequestIncoming
): Promise<DocumentQueryResponseOutgoing> {
  // Randomly return error or success response
  if (Math.random() > 0.5) {
    return constructErrorResponse(payload);
  }
  return constructSuccessResponse(payload);
}

// Function to construct error response.
function constructErrorResponse(
  payload: DocumentQueryRequestIncoming
): DocumentQueryResponseOutgoing {
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
          code: "structure",
          details: { text: "Invalid structure" },
        },
      ],
    },
  };
}

// Function to construct success response.
function constructSuccessResponse(
  payload: DocumentQueryRequestIncoming
): DocumentQueryResponseOutgoing {
  const documentReference: DocumentReference = {
    homeCommunityId: "1.2.3.4.5.6.7.8.9",
    docUniqueId: "123456789",
    urn: "urn:oid:1.2.3.4.5.6.7.8.9",
    repositoryUniqueId: "123456789",
    contentType: "application/pdf",
    url: "http://example.com/document.pdf",
  };

  return {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    documentReference: [documentReference],
  };
}

import * as Sentry from "@sentry/serverless";
import {
  DocumentQueryResponseOutgoing,
  documentQueryRequestIncomingSchema,
  DocumentQueryRequestIncoming,
} from "@metriport/ihe-gateway-sdk";

export const handler = Sentry.AWSLambda.wrapHandler(processRequest);

// Function to extract necessary fields and construct the responses.
async function processRequest(
  payload: DocumentQueryRequestIncoming
): Promise<DocumentQueryResponseOutgoing> {
  // Randomly return error or success response
  const xca = documentQueryRequestIncomingSchema.parse(payload);
  if (Math.random() > 0.5) {
    return constructErrorResponse(xca);
  }
  return constructSuccessResponse(xca);
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
  return {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    extrinsicObjectXmls: [" "],
  };
}

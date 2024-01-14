import { getEnvVar } from "@metriport/core/util/env-var";
import {
  DocumentReference,
  DocumentRetrievalRequestIncoming,
  documentRetrievalRequestIncomingSchema,
  DocumentRetrievalResponseOutgoing,
} from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";

const version = getEnvVar(`METRIPORT_VERSION`);

export const handler = Sentry.AWSLambda.wrapHandler(processRequest);

// Function to extract necessary fields and construct the responses
async function processRequest(
  payload: DocumentRetrievalRequestIncoming
): Promise<DocumentRetrievalResponseOutgoing> {
  console.log(`Running with patientId: ${payload.patientId}; version: ${version}`);

  // validate with zod schema
  const xca = documentRetrievalRequestIncomingSchema.parse(payload);
  if (Math.random() > 0.5) {
    return constructErrorResponse(xca);
  }
  return constructSuccessResponse(xca);
}

// Function to construct error response
function constructErrorResponse(
  payload: DocumentRetrievalRequestIncoming
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
          code: "structure",
          details: { text: "Invalid structure" },
        },
      ],
    },
  };
}

// Function to construct success response
function constructSuccessResponse(
  payload: DocumentRetrievalRequestIncoming
): DocumentRetrievalResponseOutgoing {
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

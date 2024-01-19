import { getEnvVar } from "@metriport/core/util/env-var";
import {
  DocumentQueryReqFromExternalGW,
  documentQueryReqFromExternalGWSchema,
  DocumentQueryRespToExternalGW,
} from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";

const version = getEnvVar(`METRIPORT_VERSION`);

export const handler = Sentry.AWSLambda.wrapHandler(processRequest);

// Function to extract necessary fields and construct the responses.
async function processRequest(
  payload: DocumentQueryReqFromExternalGW
): Promise<DocumentQueryRespToExternalGW> {
  console.log(`Running with payload: ${JSON.stringify(payload)}; version: ${version}`);

  // Randomly return error or success response
  const xca = documentQueryReqFromExternalGWSchema.parse(payload);
  if (Math.random() > 0.5) {
    return constructErrorResponse(xca);
  }
  return constructSuccessResponse(xca);
}

// Function to construct error response.
function constructErrorResponse(
  payload: DocumentQueryReqFromExternalGW
): DocumentQueryRespToExternalGW {
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
  payload: DocumentQueryReqFromExternalGW
): DocumentQueryRespToExternalGW {
  return {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    extrinsicObjectXmls: [""],
  };
}

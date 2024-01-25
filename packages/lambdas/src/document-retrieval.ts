import {
  DocumentRetrievalReqFromExternalGW,
  documentRetrievalReqFromExternalGWSchema,
} from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";
import { processIncomingRequest } from "@metriport/core/external/carequality/dr/process-incoming-dr";

export const handler = Sentry.AWSLambda.wrapHandler(
  async (payload: DocumentRetrievalReqFromExternalGW) => {
    const baseRequest = documentRetrievalReqFromExternalGWSchema.parse({
      id: payload.id,
      timestamp: payload.timestamp,
      samlAttributes: payload.samlAttributes,
      patientId: payload.patientId,
    });
    return await processIncomingRequest(baseRequest);
  }
);

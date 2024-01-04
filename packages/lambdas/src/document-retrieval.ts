import * as Sentry from "@sentry/serverless";
import {
  DocumentRetrievalRequestIncoming,
  documentRetrievalRequestIncomingSchema,
} from "@metriport/ihe-gateway-sdk";
import { processIncomingRequest } from "@metriport/core/external/carequality/dr/process-incoming-dr";

export const handler = Sentry.AWSLambda.wrapHandler(
  async (payload: DocumentRetrievalRequestIncoming) => {
    const baseRequest = documentRetrievalRequestIncomingSchema.parse({
      id: payload.id,
      timestamp: payload.timestamp,
      samlAttributes: payload.samlAttributes,
      patientId: payload.patientId,
    });
    return await processIncomingRequest(baseRequest);
  }
);

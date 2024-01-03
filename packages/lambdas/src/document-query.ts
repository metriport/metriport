import * as Sentry from "@sentry/serverless";
import {
  documentQueryRequestIncomingSchema,
  DocumentQueryRequestIncoming,
} from "@metriport/ihe-gateway-sdk";
import { processIncomingRequest } from "@metriport/core/external/carequality/dq/process-incoming-dq";

export const handler = Sentry.AWSLambda.wrapHandler(
  async (payload: DocumentQueryRequestIncoming) => {
    const baseRequest = documentQueryRequestIncomingSchema.parse({
      id: payload.id,
      timestamp: payload.timestamp,
      samlAttributes: payload.samlAttributes,
      patientId: payload.patientId,
    });
    return await processIncomingRequest(baseRequest);
  }
);

import {
  DocumentQueryReqFromExternalGW,
  documentQueryReqFromExternalGWSchema,
} from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";
import { processIncomingRequest } from "@metriport/core/external/carequality/dq/process-incoming-dq";

export const handler = Sentry.AWSLambda.wrapHandler(
  async (payload: DocumentQueryReqFromExternalGW) => {
    const baseRequest = documentQueryReqFromExternalGWSchema.parse({
      id: payload.id,
      timestamp: payload.timestamp,
      samlAttributes: payload.samlAttributes,
      patientId: payload.patientId,
    });
    return await processIncomingRequest(baseRequest);
  }
);

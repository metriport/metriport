import { inboundDocumentRetrievalReqSchema } from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";
import { processInboundDocumentRetrieval } from "@metriport/core/external/carequality/dr/process-inbound-dr";
import { APIGatewayProxyEvent } from "aws-lambda";

export const handler = Sentry.AWSLambda.wrapHandler(async (event: APIGatewayProxyEvent) => {
  if (!event.body) {
    return buildResponse(400, { message: "Request body is missing" });
  }
  const payload = JSON.parse(event.body);
  const baseRequest = inboundDocumentRetrievalReqSchema.parse({
    id: payload.id,
    timestamp: payload.timestamp,
    samlAttributes: payload.samlAttributes,
    documentReference: payload.documentReference,
  });
  const result = await processInboundDocumentRetrieval(baseRequest);
  return buildResponse(200, result);
});

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

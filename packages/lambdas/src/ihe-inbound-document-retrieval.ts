import { inboundDocumentRetrievalReqSchema } from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";
import { processInboundDocumentRetrieval } from "@metriport/core/external/carequality/dr/process-inbound-dr";

export const handler = Sentry.AWSLambda.wrapHandler(async (event: string) => {
  console.log(`Running with: ${event}`);
  if (!event) return buildResponse(400, { message: "The request is invalid" });

  const baseRequest = inboundDocumentRetrievalReqSchema.safeParse(JSON.parse(event));
  if (!baseRequest.success) return buildResponse(400, baseRequest.error);
  const result = await processInboundDocumentRetrieval(baseRequest.data);
  console.log(`Response: ${result}`);
  return buildResponse(200, result);
});

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json" },
  body: body,
});

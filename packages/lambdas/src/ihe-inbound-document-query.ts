import { inboundDocumentQueryReqSchema } from "@metriport/ihe-gateway-sdk";
import * as Sentry from "@sentry/serverless";
import { processInboundDocumentQuery } from "@metriport/core/external/carequality/dq/process-inbound-dq";

export const handler = Sentry.AWSLambda.wrapHandler(async (event: string) => {
  console.log(`Running with ${event}`);
  if (!event) return buildResponse(400, { message: "The request is invalid" });

  const baseRequest = inboundDocumentQueryReqSchema.safeParse(JSON.parse(event));
  if (!baseRequest.success) return buildResponse(400, baseRequest.error);

  const result = await processInboundDocumentQuery(baseRequest.data);
  return buildResponse(200, result);
});

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json" },
  body: body,
});

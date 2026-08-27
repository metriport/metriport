import { startDocumentQueryParamsSchema } from "@metriport/core/command/shared/api/start-document-query";
import { DocumentQueryStarterDirect } from "@metriport/core/command/shared/document-query/document-query-starter-direct";
import { Config } from "@metriport/core/util/config";
import { SQSEvent } from "aws-lambda";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import { parseBody } from "./shared/parse-body";
import { getSingleMessageOrFail } from "./shared/sqs";
// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(async function handler(event: SQSEvent) {
  capture.setExtra({ event, context: lambdaName });
  const startedAt = new Date().getTime();
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const parsedBody = parseBody<typeof startDocumentQueryParamsSchema>(
    startDocumentQueryParamsSchema,
    message.body
  );
  const { cxId, patientId, requestId } = parsedBody;
  capture.setExtra({ ...parsedBody });

  const log = prefixedLog(`cxId ${cxId}, requestId ${requestId}, patientId ${patientId}`);

  // Read wait time at runtime (not cached at initialization)
  const waitTimeInMillis = Config.getWaitTimeInMillis();
  const direct = new DocumentQueryStarterDirect(waitTimeInMillis);
  await direct.startDocumentQueries([parsedBody]);

  const finishedAt = new Date().getTime();
  log(`Done. Duration: ${finishedAt - startedAt}ms`);
});

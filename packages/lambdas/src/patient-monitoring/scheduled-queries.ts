import { runScheduledQueriesRequestSchema } from "@metriport/core/command/patient-monitoring/scheduled-queries/scheduled-queries";
import { ScheduledQueriesDirect } from "@metriport/core/command/patient-monitoring/scheduled-queries/scheduled-queries-direct";
import { SQSEvent } from "aws-lambda";
import { capture } from "../shared/capture";
import { getEnvOrFail } from "../shared/env";
import { prefixedLog } from "../shared/log";
import { parseBody } from "../shared/parse-body";
import { getSingleMessageOrFail } from "../shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

/**
 * Lambda handler for scheduled queries.
 *
 * Consumes messages from SQS queue with cxId and cadences array, then executes
 * monitoring actions for cohorts matching those cadences for the specified customer.
 */
export const handler = capture.wrapHandler(async (event: SQSEvent): Promise<void> => {
  capture.setExtra({ context: lambdaName, event });
  const startedAt = new Date().getTime();

  const log = prefixedLog(`scheduled-queries`);

  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const parsedBody = parseBody(runScheduledQueriesRequestSchema, message.body);
  capture.setExtra({ ...parsedBody });

  const { cxId, cadences } = parsedBody;
  log(`Starting scheduled queries for cx ${cxId}, cadences [${cadences.join(", ")}]`);

  const runner = new ScheduledQueriesDirect();
  await runner.runScheduledQueries(parsedBody);

  const finishedAt = new Date().getTime();
  const duration = finishedAt - startedAt;
  log(`Scheduled queries completed in ${duration}ms`);
});

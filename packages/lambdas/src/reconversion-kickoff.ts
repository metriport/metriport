import {
  DocumentReconversionKickoffDirect,
  ReconversionKickoffParams,
} from "@metriport/core/command/reconversion/reconversion-kickoff";
import { SQSEvent } from "aws-lambda";
import { z } from "zod";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import { getSingleMessageOrFail } from "./shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const apiUrl = getEnvOrFail("API_URL");

export const handler = capture.wrapHandler(async (event: SQSEvent): Promise<void> => {
  const params = getSingleMessageOrFail(event.Records, lambdaName);
  if (!params) {
    throw new Error("No message found in SQS event");
  }

  const log = prefixedLog(lambdaName);
  log("Parsing body");
  const parsedBody = parseBody(params.body);
  const { cxId, messageId, patientIds, dateFrom, dateTo } = parsedBody;
  log(`Parsed into: ${JSON.stringify(parsedBody)}`);

  capture.setExtra({
    cxId,
    messageId,
    patientIds,
    dateFrom,
    dateTo,
    context: "reconversion-kickoff-cloud.execute",
  });

  const executeParams: ReconversionKickoffParams = { ...parsedBody, apiUrl };
  await new DocumentReconversionKickoffDirect().execute(executeParams);
});

const parseBody = (body: string): Omit<ReconversionKickoffParams, "apiUrl"> => {
  const schema = z.object({
    messageId: z.string(),
    cxId: z.string().uuid(),
    patientIds: z.array(z.string().uuid()),
    dateFrom: z.string(),
    dateTo: z.string().optional(),
  });

  return schema.parse(JSON.parse(body));
};

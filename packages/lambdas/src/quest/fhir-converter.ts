import { capture } from "../shared/capture";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { getSingleMessageOrFail } from "../shared/sqs";
import { parseBody } from "../shared/parse-body";
import { SQSEvent } from "aws-lambda";
import { z } from "zod";

capture.init();

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  capture.setExtra({ context: lambdaName });
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  parseBody(questFhirConverterSchema, message.body);
});

const questFhirConverterSchema = z.object({
  externalId: z.string(),
  updateFileName: z.string(),
});

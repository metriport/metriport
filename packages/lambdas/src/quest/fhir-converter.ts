import { capture } from "../shared/capture";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { getSingleMessageOrFail } from "../shared/sqs";
import { prefixedLog } from "../shared/log";
import { parseBody } from "../shared/parse-body";
import { SQSEvent } from "aws-lambda";
import { QuestFhirConverterCommandDirect } from "@metriport/core/external/quest/command/fhir-converter/fhir-converter-direct";
import {
  QuestFhirConversionRequest,
  questFhirConversionRequestSchema,
} from "@metriport/core/external/quest/types";

capture.init();

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(async (event: SQSEvent) => {
  const log = prefixedLog("quest.fhir-converter");
  capture.setExtra({ context: lambdaName });
  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  log("Starting conversion of Quest source document to FHIR bundle");
  const request = parseBody<QuestFhirConversionRequest>(
    questFhirConversionRequestSchema,
    message.body
  );
  const handler = new QuestFhirConverterCommandDirect();
  await handler.convertSourceDocumentToFhirBundle(request);
  log("Conversion of Quest source document to FHIR bundle completed");
});

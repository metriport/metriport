import { FhirToCsvDirect } from "@metriport/core/command/analytics-platform/fhir-to-csv/command/fhir-to-csv/fhir-to-csv-direct";
import { doesConsolidatedDataExist } from "@metriport/core/command/consolidated/consolidated-get";
import { MetriportError } from "@metriport/shared";
import { Context, SQSEvent } from "aws-lambda";
import { fhirToCsvSchema } from "../shared/analytics-platform";
import { capture } from "../shared/capture";
import { getEnvOrFail } from "../shared/env";
import { prefixedLog } from "../shared/log";
import { parseBody } from "../shared/parse-body";
import { getSingleMessageOrFail } from "../shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");

export const handler = capture.wrapHandler(async (event: SQSEvent, context: Context) => {
  capture.setExtra({ event, context: lambdaName });

  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;

  const parsedBody = parseBody(fhirToCsvSchema, message.body);
  const { jobId, cxId, patientId } = parsedBody;

  const log = prefixedLog(`jobId ${jobId}, cxId ${cxId}, patientId ${patientId}`);
  log(`Parsed: ${JSON.stringify(parsedBody)}`);

  const doesPatientHaveConsolidatedBundle = await doesConsolidatedDataExist(cxId, patientId);
  if (!doesPatientHaveConsolidatedBundle) {
    const msg = `Patient does not have a consolidated bundle`;
    log(msg);
    throw new MetriportError(msg, undefined, { cxId, patientId, jobId });
  }

  log(`Invoking lambda ${lambdaName}...`);
  const fhirToCsvHandler = new FhirToCsvDirect();
  await fhirToCsvHandler.processFhirToCsv({
    ...parsedBody,
    timeoutInMillis: context.getRemainingTimeInMillis() - 200,
  });
});

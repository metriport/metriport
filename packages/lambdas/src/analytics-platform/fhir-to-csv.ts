import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { FhirToCsvDirect } from "@metriport/core/command/analytics-platform/fhir-to-csv/command/fhir-to-csv/fhir-to-csv-direct";
import { errorToString } from "@metriport/shared";
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
const secretName = getEnvOrFail("SNOWFLAKE_CREDS_SECRET_NAME");

export const handler = capture.wrapHandler(async (event: SQSEvent, context: Context) => {
  capture.setExtra({ event, context: lambdaName });

  const message = getSingleMessageOrFail(event.Records, lambdaName);
  if (!message) return;
  try {
    const parsedBody = parseBody(fhirToCsvSchema, message.body);
    const { jobId, cxId, patientId } = parsedBody;

    const log = prefixedLog(`jobId ${jobId}, cxId ${cxId}, patientId ${patientId}`);
    log(`Parsed: ${JSON.stringify(parsedBody)}`);

    const creds = (await getSecret(secretName)) as string;
    if (!creds) {
      throw new Error(`Config error - secret ${secretName} is empty/could not be retrieved`);
    }
    // TODO read the env var name from a share place and update infra to use that too
    process.env.SNOWFLAKE_CREDS = creds;

    const fhirToCsvHandler = new FhirToCsvDirect();
    await fhirToCsvHandler.processFhirToCsv({
      ...parsedBody,
      timeoutInMillis: context.getRemainingTimeInMillis() - 200,
    });
  } catch (error) {
    console.error("Re-throwing error ", errorToString(error));
    throw error;
  }
});

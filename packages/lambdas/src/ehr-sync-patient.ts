import { errorToString, MetriportError, sleep } from "@metriport/shared";
import { SQSEvent } from "aws-lambda";
import { isAxiosError } from "axios";
import { capture } from "./shared/capture";
import { parseEhrIds } from "./shared/ehr";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import { apiClient } from "./shared/oss-api";
import { getSingleMessageOrFail } from "./shared/sqs";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const waitTimeInMillisRaw = getEnvOrFail("WAIT_TIME_IN_MILLIS");
const waitTimeInMillis = parseInt(waitTimeInMillisRaw);
const apiUrl = getEnvOrFail("API_URL");
const ossApi = apiClient(apiUrl);

// Don't use Sentry's default error handler b/c we want to use our own and send more context-aware data
export async function handler(event: SQSEvent) {
  let errorHandled = false;
  const errorMsg = "Error processing event on " + lambdaName;
  const startedAt = new Date().getTime();
  try {
    const message = getSingleMessageOrFail(event.Records, lambdaName);
    if (!message) return;

    console.log(`Running with unparsed body: ${message.body}`);
    const parsedBody = parseBody(message.body);
    const { cxId, ehrId, ehrPracticeId, ehrPatientId } = parsedBody;

    const log = prefixedLog(
      `cxId ${cxId}, ehrId ${ehrId}, ehrPracticeId ${ehrPracticeId}, ehrPatientId ${ehrPatientId}`
    );
    try {
      log(`Parsed: ${JSON.stringify(parsedBody)}, waitTimeInMillis ${waitTimeInMillis}`);

      const response = await ossApi.internal.ehrSyncPatient(parsedBody);
      log(`Response: ${JSON.stringify(response)}`);

      await sleep(waitTimeInMillis);

      const finishedAt = new Date().getTime();
      log(`Done local duration: ${finishedAt - startedAt}ms`);
    } catch (error) {
      errorHandled = true;
      log(`${errorMsg}: ${errorToString(error)}`);
      if (
        isAxiosError(error) &&
        (error.response?.status === 404 || error.response?.status === 404)
      ) {
        log(`Skipping error ${error.response?.status}`);
        return;
      }
      capture.error(errorMsg, {
        extra: { event, context: lambdaName, error },
      });
      throw new MetriportError(errorMsg, error, {
        ...{ ...parsedBody, patientPayload: undefined },
      });
    }
  } catch (error) {
    if (errorHandled) throw error;
    console.log(`${errorMsg}: ${errorToString(error)}`);
    capture.error(errorMsg, {
      extra: { event, context: lambdaName, error },
    });
    throw new MetriportError(errorMsg, error);
  }
}

function parseBody(body?: unknown): {
  cxId: string;
  ehrId: string;
  ehrPracticeId: string;
  ehrPatientId: string;
} {
  if (!body) throw new Error(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new Error(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  const { cxIdRaw, ehrIdRaw, ehrPracticeIdRaw, ehrPatientIdRaw } = parseEhrIds(bodyAsJson);

  const cxId = cxIdRaw;
  const ehrId = ehrIdRaw;
  const ehrPracticeId = ehrPracticeIdRaw;
  const ehrPatientId = ehrPatientIdRaw;

  return {
    cxId,
    ehrId,
    ehrPracticeId,
    ehrPatientId,
  };
}

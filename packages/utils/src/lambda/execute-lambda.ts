import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { InvokeCommand, LogType } from "@aws-sdk/client-lambda";
import {
  getLambdaResultPayloadV3,
  logResultToString,
  makeLambdaClientV3,
} from "@metriport/core/external/aws/lambda";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Script to execute a lambda.
 *
 * Update the lambda name, potentially the request payload, and run this script.
 */

const lambdaName = "TesterLambda";
const payload = {};

const region = getEnvVarOrFail("AWS_REGION");
const lambdaClient = makeLambdaClientV3(region);

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${buildDayjs().toISOString()} ##############`);

  const command = new InvokeCommand({
    FunctionName: lambdaName,
    Payload: JSON.stringify(payload),
    LogType: LogType.Tail,
  });
  const lambdaResult = await lambdaClient.send(command);

  if (lambdaResult.StatusCode !== 200) {
    throw new MetriportError("Lambda invocation failed", undefined, {
      lambdaName,
      status: lambdaResult.StatusCode,
      log: logResultToString(lambdaResult.LogResult),
      payload: lambdaResult.Payload?.toString(),
    });
  }
  if (!lambdaResult.Payload) {
    throw new MetriportError("Payload is undefined", undefined, {
      lambdaName,
      status: lambdaResult.StatusCode,
      log: logResultToString(lambdaResult.LogResult),
    });
  }
  const response = getLambdaResultPayloadV3({ result: lambdaResult, lambdaName });

  console.log(`Response: ${response}`);

  console.log(`############## Done in ${elapsedTimeAsStr(startedAt)}`);
}

main();

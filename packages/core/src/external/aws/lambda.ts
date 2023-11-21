import * as AWS from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";
import { base64ToString } from "../../util/base64";
import { MetriportError } from "../../util/error/metriport-error";
import NotFoundError from "../../util/error/not-found";

export function makeLambdaClient(region: string) {
  return new AWS.Lambda({ signatureVersion: "v4", region });
}

export function logResultToString(logResult: string | undefined): string | undefined {
  if (!logResult) return logResult;
  return base64ToString(logResult);
}

/**
 * Checks whether the lambda invocation was successful.
 */
export function isLambdaError(
  result: PromiseResult<AWS.Lambda.InvocationResponse, AWS.AWSError>
): boolean {
  return result.FunctionError !== undefined;
}

export type LambdaError = {
  errorType: string;
  errorMessage: string;
  log: string | undefined;
};

/**
 * Returns the error details if the lambda invocation failed.
 */
export function getLambdaError(
  result: PromiseResult<AWS.Lambda.InvocationResponse, AWS.AWSError>
): LambdaError | undefined {
  if (!result.Payload) return undefined;
  if (!isLambdaError(result)) return undefined;
  const response = JSON.parse(result.Payload.toString());
  return {
    errorType: response.errorType,
    errorMessage: response.errorMessage,
    log: logResultToString(result.LogResult),
  };
}

/**
 * Returns a string representation of the payload if the lambda invocation was successful.
 * If the lambda invocation failed, it throws a MetriportError (unless `failGracefully` is true,
 * in which case it returns `undefined`).
 *
 * @param result The result of the lambda invocation
 * @param lambdaName The name of the lambda that was invoked, used on error reporting (optional)
 * @param failGracefuly If true, the function will return `undefined` instead of throwing an
 *        error (optional, defaults to `false` - throw an error on failure)
 * @param log A function to log errors (optional, defaults to `console.log`)
 * @returns The payload of the lambda invocation
 */
export function getLambdaResultPayload(params: {
  result: PromiseResult<AWS.Lambda.InvocationResponse, AWS.AWSError>;
  lambdaName?: string;
  failGracefuly?: boolean | false;
  log?: typeof console.log;
}): string;
export function getLambdaResultPayload(params: {
  result: PromiseResult<AWS.Lambda.InvocationResponse, AWS.AWSError>;
  lambdaName?: string;
  failGracefuly: true;
  log?: typeof console.log;
}): string | undefined;
export function getLambdaResultPayload({
  result,
  lambdaName = "<unknown-name>",
  failGracefuly = false,
  log = console.log,
}: {
  result: PromiseResult<AWS.Lambda.InvocationResponse, AWS.AWSError>;
  lambdaName?: string;
  failGracefuly?: boolean;
  log?: typeof console.log;
}): string | undefined {
  if (result.StatusCode !== 200) {
    if (failGracefuly) return undefined;
    throw new MetriportError("Lambda invocation failed", undefined, { lambdaName });
  }
  if (!result.Payload) {
    if (failGracefuly) return undefined;
    throw new MetriportError("Lambda payload is undefined", undefined, { lambdaName });
  }
  if (isLambdaError(result)) {
    const msg = `Error calling lambda ${lambdaName}`;
    const lambdaError = getLambdaError(result);
    const errorDetails = JSON.stringify(lambdaError);
    log(`${msg} - ${errorDetails}`);
    if (failGracefuly) return undefined;
    if (lambdaError?.errorType === "NotFoundError") {
      throw new NotFoundError(msg, undefined, { lambdaName, errorDetails });
    }
    throw new MetriportError(msg, undefined, { lambdaName, errorDetails });
  }
  return result.Payload.toString();
}

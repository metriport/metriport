import { BadRequestError, MetriportError, NotFoundError } from "@metriport/shared";
import * as AWS from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";
import { base64ToString } from "../../util/base64";
import { out } from "../../util/log";

/**
 * Returns a new AWS Lambda client.
 * Note: callers are responsible for handling the error, usually by calling `getLambdaResultPayload()`.
 */
export function makeLambdaClient(region: string, timeoutInMillis?: number) {
  return new AWS.Lambda({
    signatureVersion: "v4",
    region,
    ...(timeoutInMillis ? { httpOptions: { timeout: timeoutInMillis } } : {}),
  });
}

/**
 * Returns a function that can be used to handle the result of a lambda invocation.
 * This function will return the payload of the lambda invocation as string, or undefined if the
 * lambda invocation failed or if the lambda invocation returns an empty response.
 */
export function defaultLambdaInvocationResponseHandler(params: {
  lambdaName?: string;
  failGracefully?: boolean | false;
}): (result: PromiseResult<AWS.Lambda.InvocationResponse, AWS.AWSError>) => string | undefined {
  return function (
    result: PromiseResult<AWS.Lambda.InvocationResponse, AWS.AWSError>
  ): string | undefined {
    return getLambdaResultPayload({ result, failOnEmptyResponse: false, ...params });
  };
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
 * @param failGracefully If true, the function will return `undefined` instead of throwing an
 *        error (optional, defaults to `false` - throw an error on failure)
 * @param failOnEmptyResponse If false, the function will return `undefined` instead of throwing an
 *        error in case the lambda doesn't return anything (optional, defaults to `true` - throw
 *        missing a response)
 * @param log A function to log errors (optional, defaults to `console.log`)
 * @returns The payload of the lambda invocation
 */
export function getLambdaResultPayload(params: {
  result: PromiseResult<AWS.Lambda.InvocationResponse, AWS.AWSError>;
  lambdaName?: string;
  failGracefully?: boolean | false;
  failOnEmptyResponse?: boolean | false;
  log?: typeof console.log;
}): string;
export function getLambdaResultPayload(params: {
  result: PromiseResult<AWS.Lambda.InvocationResponse, AWS.AWSError>;
  lambdaName?: string;
  failGracefully: true;
  failOnEmptyResponse?: boolean | false;
  log?: typeof console.log;
}): string | undefined;
export function getLambdaResultPayload({
  result,
  lambdaName = "<unknown-name>",
  failGracefully = false,
  failOnEmptyResponse = true,
  log = out("getLambdaResultPayload").log,
}: {
  result: PromiseResult<AWS.Lambda.InvocationResponse, AWS.AWSError>;
  lambdaName?: string;
  failGracefully?: boolean;
  failOnEmptyResponse?: boolean;
  log?: typeof console.log;
}): string | undefined {
  if (!result.StatusCode || result.StatusCode < 200 || result.StatusCode > 299) {
    if (failGracefully) return undefined;
    throw new MetriportError("Lambda invocation failed", undefined, {
      lambdaName,
      statusCode: result.StatusCode,
    });
  }
  if (!result.Payload) {
    if (failGracefully || !failOnEmptyResponse) return undefined;
    throw new MetriportError("Lambda payload is undefined", undefined, { lambdaName });
  }
  if (isLambdaError(result)) {
    const msg = `Error calling lambda ${lambdaName}`;
    const lambdaError = getLambdaError(result);
    const errorDetails = JSON.stringify(lambdaError);
    log(`${msg} - ${errorDetails}`);
    if (failGracefully) return undefined;

    if (lambdaError?.errorType === "BadRequestError" && lambdaError?.errorMessage) {
      throw new BadRequestError(lambdaError.errorMessage);
    }
    if (lambdaError?.errorType === "NotFoundError") {
      throw new NotFoundError(msg, undefined, { lambdaName, errorDetails });
    }
    throw new MetriportError(msg, undefined, { lambdaName, errorDetails });
  }
  return result.Payload.toString();
}

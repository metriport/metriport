/**
 * Borrowed from @sentry/serverless:
 * https://github.com/getsentry/sentry-javascript/blob/develop/packages/serverless/src/awslambda.ts
 */
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { AsyncHandler } from "@sentry/serverless/types/awslambda";
import { Handler } from "aws-lambda";
import { types } from "util";
import { capture } from "./capture";

type SyncHandler<T extends Handler> = (
  event: Parameters<T>[0],
  context: Parameters<T>[1],
  callback: Parameters<T>[2]
) => void;

const { isPromise } = types;

export function defaultHandler<TEvent, TResult>(
  handler: Handler<TEvent, TResult>
): Handler<TEvent, TResult> {
  const asyncHandler: AsyncHandler<typeof handler> =
    handler.length > 2
      ? (event, context) =>
          new Promise((resolve, reject) => {
            const rv = (handler as SyncHandler<typeof handler>)(event, context, (error, result) => {
              if (error === null || error === undefined) {
                resolve(result!); // eslint-disable-line @typescript-eslint/no-non-null-assertion
              } else {
                reject(error);
              }
            }) as unknown;

            // This should never happen, but still can if someone writes a handler as
            // `async (event, context, callback) => {}`
            if (isPromise(rv)) {
              void (rv as Promise<NonNullable<TResult>>).then(resolve, reject);
            }
          })
      : (handler as AsyncHandler<typeof handler>);

  return async (event, context) => {
    try {
      return await asyncHandler(event, context);
    } catch (error) {
      if (error instanceof MetriportError && error.additionalInfo) {
        capture.setExtra(error.additionalInfo);
      }
      throw error;
    }
  };
}

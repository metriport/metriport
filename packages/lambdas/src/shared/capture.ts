import { Capture } from "@metriport/core/util/capture";
import { getEnvType, getEnvVar } from "@metriport/core/util/env-var";
import { errorToString, MetriportError } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import { Extras } from "@sentry/types";
import { ScopeContext } from "@sentry/types/types/scope";
import * as AWSLambda from "aws-lambda";
import { isAxiosError } from "axios";

const sentryDsn = getEnvVar("SENTRY_DSN");

export type UserData = Pick<Sentry.AWSLambda.User, "id" | "email">;

export type LambdaCapture = Capture & {
  setUser: (user: UserData) => void;
  setExtra: (extra: Record<string, unknown>) => void;
};

export const capture = {
  /**
   * Initializes Sentry.
   * Requires the ENV_TYPE env var to be set or it breaks.
   * If the SENTRY_DSN env var is not set, Sentry is disabled.
   *
   * @param tracesSampleRate Sample rate to determine trace sampling.
   */
  init: (tracesSampleRate = 0.01): void => {
    Sentry.init({
      dsn: sentryDsn,
      enabled: sentryDsn != null,
      environment: getEnvType(),
      sampleRate: 1.0, // error sample rate
      tracesSampleRate, // transaction sample rate
    });
  },

  setUser: (user: UserData): void => {
    Sentry.setUser(user);
  },

  setExtra: (extra: Record<string, unknown>): void => {
    Object.entries(extra).forEach(([key, value]) => {
      Sentry.setExtra(key, value);
    });
  },

  /**
   * Captures an exception event and sends it to Sentry.
   *
   * @param error — An Error object.
   * @param captureContext — Additional scope data to apply to exception event.
   * @returns — The generated eventId.
   */
  error: (error: unknown, captureContext?: Partial<ScopeContext>): string => {
    const extra = captureContext ? stringifyExtra(captureContext) : {};
    return Sentry.captureException(error, {
      ...captureContext,
      extra,
    });
  },

  /**
   * Captures an exception event and sends it to Sentry.
   *
   * @param message The message to send to Sentry.
   * @param captureContext — Additional scope data to apply to exception event.
   * @returns — The generated eventId.
   */
  message: (message: string, captureContext?: Partial<ScopeContext>): string => {
    const extra = captureContext ? stringifyExtra(captureContext) : {};
    return Sentry.captureMessage(message, {
      ...captureContext,
      extra,
    });
  },

  /**
   * Wraps an AWS Lambda handler to capture errors and send them to Sentry.
   *
   * While using this, don't call `capture.[error|message]` to report errors
   * to Sentry/Slack, this function already takes care of this as long as
   * the error is "bubbled up" out of the lambda handler.
   *
   * To send "extra"/additional data to Sentry, you can make sure to throw a
   * MetriportError (or subclass) with the "extra" set on the error's
   * `additionalInfo` property.
   *
   * @param handler — The AWS Lambda handler to wrap.
   * @returns — The wrapped handler.
   */
  wrapHandler: (handler: AWSLambda.Handler): AWSLambda.Handler => {
    return Sentry.AWSLambda.wrapHandler(async (event, context, callback) => {
      try {
        return await handler(event, context, callback);
      } catch (error) {
        console.log(`Error: ${errorToString(error)}`);
        if (error instanceof MetriportError && error.additionalInfo) {
          capture.setExtra(error.additionalInfo);
        }
        if (isAxiosError(error)) {
          capture.setExtra({
            stack: error.stack,
            method: error.config?.method,
            url: error.config?.url,
            data: error.response?.data,
          });
        }
        throw error;
      }
    });
  },
};

function stringifyExtra(captureContext: Partial<ScopeContext>): Extras {
  return Object.entries(captureContext.extra ?? {}).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    }),
    {}
  );
}

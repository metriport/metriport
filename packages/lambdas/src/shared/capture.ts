import { Capture } from "@metriport/core/util/capture";
import { getEnvType, getEnvVar } from "@metriport/core/util/env-var";
import * as Sentry from "@sentry/serverless";
import { Extras } from "@sentry/types";
import { ScopeContext } from "@sentry/types/types/scope";

const sentryDsn = getEnvVar("SENTRY_DSN");

export type UserData = Pick<Sentry.AWSLambda.User, "id" | "email">;

export type LambdaCapture = Capture & {
  setUser: (user: UserData) => void;
  setExtra: (extra: Record<string, unknown>) => void;
};

export const capture = {
  // TODO #499 Review 'tracesSampleRate' based on the load on our app and Sentry's quotas
  /**
   * Initializes Sentry.
   * Requires the ENV_TYPE env var to be set or it breaks.
   * If the SENTRY_DSN env var is not set, Sentry is disabled.
   *
   * @param tracesSampleRate Sample rate to determine trace sampling.
   */
  init: (tracesSampleRate = 0.5): void => {
    Sentry.init({
      dsn: sentryDsn,
      enabled: sentryDsn != null,
      environment: getEnvType(),
      tracesSampleRate,
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
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (error: any, captureContext?: Partial<ScopeContext>): string => {
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

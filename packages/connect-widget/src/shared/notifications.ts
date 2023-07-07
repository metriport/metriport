import * as Sentry from "@sentry/react";
import { Extras, ScopeContext } from "@sentry/types";

export const capture = {
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

export function stringifyExtra(captureContext: Partial<ScopeContext>): Extras {
  return Object.entries(captureContext.extra ?? {}).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: JSON.stringify(value, null, 2),
    }),
    {}
  );
}

import { ScopeContext } from "@sentry/types";

export type AdditionalInfo = Record<string, string | number | boolean | undefined | null>;

export type Capture = {
  /**
   * Captures an exception event and sends it to Sentry.
   *
   * @param error — An Error object.
   * @param captureContext — Additional scope data to apply to exception event.
   * @returns — The generated eventId.
   */
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (error: any, captureContext?: Partial<ScopeContext>) => string;

  /**
   * Captures an exception event and sends it to Sentry.
   *
   * @param message The message to send to Sentry.
   * @param captureContext — Additional scope data to apply to exception event.
   * @returns — The generated eventId.
   */
  message: (message: string, captureContext?: Partial<ScopeContext>) => string;
};

export const emptyCapture: Capture = {
  error: () => "",
  message: () => "",
};

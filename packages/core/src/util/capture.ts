import * as Sentry from "@sentry/node";
import { Extras, ScopeContext } from "@sentry/types";
import stringify from "json-stringify-safe";
import { SlackMessage as CoreSlackMessage } from "../external/slack/index";
import { MetriportError } from "./error/metriport-error";

export type SlackMessage = CoreSlackMessage;

export type UserData = Pick<Sentry.User, "id" | "email">;

export type ApiCapture = Capture & {
  setUser: (user: UserData) => void;
  setExtra: (extra: Record<string, unknown>) => void;
};

export const capture: ApiCapture = {
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
    if (typeof error === "string") {
      return capture.message(error, {
        ...captureContext,
        level: captureContext?.level ?? "error",
      });
    }
    const extra = captureContext ? stringifyExtra(captureContext) : {};
    return Sentry.captureException(error, {
      ...captureContext,
      extra,
      ...(error instanceof MetriportError ? error.additionalInfo : {}),
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
      [key]: typeof value === "string" ? value : stringify(value, null, 2),
    }),
    {}
  );
}

export type Capture = {
  /**
   * Captures an exception event and sends it to Sentry.
   *
   * @param error — An Error object.
   * @param captureContext — Additional scope data to apply to exception event.
   * @returns — The generated eventId.
   */
  error: (error: unknown, captureContext?: Partial<ScopeContext>) => string;

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

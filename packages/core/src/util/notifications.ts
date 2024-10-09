import * as Sentry from "@sentry/node";
import { Extras, ScopeContext } from "@sentry/types";
import stringify from "json-stringify-safe";
import { MetriportError } from "@metriport/shared";
import {
  sendAlert as sendAlertToSlack,
  sendNotification as sendNotificationToSlack,
  SlackMessage,
} from "../external/slack/index";
import { Capture } from "./capture";

export type NotificationMessage = SlackMessage;

export async function sendNotification(notif: NotificationMessage | string): Promise<void> {
  return sendNotificationToSlack(notif);
}

export async function sendAlert(notif: NotificationMessage | string): Promise<void> {
  return sendAlertToSlack(notif);
}

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
   * @param error — An Error object or a string message.
   * @param captureContext — Additional scope data to apply to exception event.
   * @param captureContext.level — Available levels are "fatal", "error", "warning", "log", "info",
   *        and "debug" (defaults to "error").
   * @param captureContext.extra — Additional information to be sent with the alert.
   * @returns — The generated eventId.
   */
  error: (error: unknown, captureContext?: Partial<ScopeContext>): string => {
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
   * Sends a message to Sentry.
   *
   * @param message The message to send to Sentry.
   * @param captureContext — Additional scope data to apply to exception event.
   * @param captureContext.level — Available levels are "fatal", "error", "warning", "log", "info",
   *        and "debug" (defaults to "info").
   * @param captureContext.extra — Additional information to be sent with the alert.
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

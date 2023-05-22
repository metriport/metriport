import * as Sentry from "@sentry/node";
import axios from "axios";
import MetriportError from "../errors/metriport-error";
import { Config } from "./config";

const slackAlertUrl = Config.getSlackAlertUrl();
const slackNotificationUrl = Config.getSlackNotificationUrl();

export interface SlackMessage {
  message: string;
  subject: string;
  emoji?: string;
}

const sendToSlack = async (
  notif: SlackMessage | string,
  url: string | undefined
): Promise<void> => {
  let subject: string;
  let message: string | undefined = undefined;
  let emoji: string | undefined = undefined;
  if (typeof notif === "string") {
    subject = notif as string;
  } else {
    const n: SlackMessage = notif as SlackMessage;
    message = n.message;
    subject = n.subject;
    emoji = n.emoji ?? emoji;
  }
  if (!url) {
    console.log(`Could not send to Slack, missing URL - ${subject}: ${message ?? "''"}`);
    return;
  }

  const payload = JSON.stringify({
    text: subject + (message ? `:${"\n```\n"}${message}${"\n```"}` : ""),
    ...(emoji ? { icon_emoji: emoji } : undefined),
  });

  return axios.post(url, payload, {
    headers: { "Content-Type": "application/json" },
  });
};

export const sendNotification = async (notif: SlackMessage | string): Promise<void> =>
  sendToSlack(notif, slackNotificationUrl);

export const sendAlert = async (notif: SlackMessage | string): Promise<void> =>
  sendToSlack(notif, slackAlertUrl);

export type CaptureContext = {
  user: { id?: string; email?: string };
  extra: Record<string, unknown>;
  tags: {
    [key: string]: string;
  };
};

export type SeverityLevel = "fatal" | "error" | "warning" | "log" | "info" | "debug";

export type UserData = Pick<Sentry.User, "id" | "email">;

export const capture = {
  setUser: (user: UserData): void => {
    Sentry.setUser(user);
  },

  /**
   * Captures an exception event and sends it to Sentry.
   *
   * @param error — An Error object.
   * @param captureContext — Additional scope data to apply to exception event.
   * @returns — The generated eventId.
   */
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (error: any, captureContext?: Partial<CaptureContext>): string => {
    return Sentry.captureException(error, {
      ...captureContext,
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
  message: (message: string, captureContext?: Partial<CaptureContext> | SeverityLevel): string => {
    return Sentry.captureMessage(message, captureContext);
  },
};

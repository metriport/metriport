import axios from "axios";
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

// TODO #156 remove this?
export const sendNotification = async (notif: SlackMessage | string): Promise<void> =>
  sendToSlack(notif, slackNotificationUrl);

// TODO #156 remove this?
export const sendAlert = async (notif: SlackMessage | string): Promise<void> =>
  sendToSlack(notif, slackAlertUrl);

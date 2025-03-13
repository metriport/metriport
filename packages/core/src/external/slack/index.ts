import { errorToString } from "@metriport/shared";
import axios from "axios";
import stringify from "json-stringify-safe";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";

const slackAlertUrl = Config.getSlackAlertUrl();
const slackNotificationUrl = Config.getSlackNotificationUrl();
const slackSecurityNotificationUrl = Config.getSlackSecurityNotificationUrl();

export interface SlackMessage {
  subject: string;
  message?: string;
  emoji?: string;
}

export async function sendToSlack(
  notif: SlackMessage | string,
  url: string | undefined
): Promise<void> {
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

  const payload = stringify({
    text: subject + (message ? `:${"\n```\n"}${message}${"\n```"}` : ""),
    ...(emoji ? { icon_emoji: emoji } : undefined),
  });

  return axios.post(url, payload, {
    headers: { "Content-Type": "application/json" },
  });
}

export function sendNotification(notif: SlackMessage | string): Promise<void> {
  return sendToSlack(notif, slackNotificationUrl);
}

export function sendAlert(notif: SlackMessage | string): Promise<void> {
  return sendToSlack(notif, slackAlertUrl);
}

export async function sendSecurityNotification(notif: SlackMessage): Promise<void> {
  const context = "sendSecurityNotification";
  const { log } = out(context);
  try {
    if (!slackSecurityNotificationUrl) {
      const msg = "Could not send security notification to Slack, missing URL";
      log(`${msg} - subject: ${notif.subject}`);
      capture.message(msg, {
        extra: { subject: notif.subject, context },
        level: "warning",
      });
      return;
    }
    return await sendToSlack(notif, slackSecurityNotificationUrl);
  } catch (error) {
    const msg = `Error sending security notification to Slack`;
    log(`${msg} - subject: ${notif.subject} - error: ${errorToString(error)}`);
    capture.error(msg, {
      extra: { subject: notif.subject, context, error },
    });
  }
}

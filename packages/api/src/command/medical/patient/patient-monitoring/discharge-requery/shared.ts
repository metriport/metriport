import { sendToSlack, SlackMessage } from "@metriport/core/external/slack/index";
import { Config } from "@metriport/core/util/config";
import { capture } from "@metriport/core/util";

// TODO ENG-601 - Remove this once we have tested this solution live
export async function sendNotificationToSlack(subject: string, msg: string) {
  const message: SlackMessage = {
    subject,
    message: msg,
    emoji: ":peepo_hey:",
  };

  const channelUrl = Config.getDischargeNotificationSlackUrl();
  if (!channelUrl) {
    capture.message("Discharge Slack URL is not configured", { level: "warning" });
    return;
  }
  try {
    await sendToSlack(message, channelUrl);
  } catch (error) {
    capture.error(error, { extra: { msg, subject } });
  }
}

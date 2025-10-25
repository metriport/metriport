import { sendToSlack, SlackMessage } from "@metriport/core/external/slack/index";
import { capture, out } from "@metriport/core/util";
import { Config } from "@metriport/core/util/config";
import { errorToString } from "@metriport/shared/common/error";

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
    const { log } = out("sendNotificationToSlack");
    log(`Error sending notification to Slack: ${errorToString(error)}`);
  }
}

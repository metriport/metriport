import { sendToSlack, SlackMessage } from "@metriport/core/external/slack/index";
import { Config } from "@metriport/core/util/config";

// TODO ENG-601 - Remove this once we have tested this solution live
export async function sendNotificationToSlack(msg: string, encounterIds: string[]) {
  const message: SlackMessage = {
    subject: msg,
    message: JSON.stringify(encounterIds, null, 2),
    emoji: ":peepo_hey:",
  };

  const channelUrl = Config.getDischargeNotificationSlackUrl();
  await sendToSlack(message, channelUrl);
}

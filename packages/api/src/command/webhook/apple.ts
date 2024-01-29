import { AppleWebhookPayload } from "../../mappings/apple";
import { errorToString } from "../../shared/log";
import { Util } from "../../shared/util";
import { getConnectedUserOrFail } from "../connected-user/get-connected-user";
import { getSettingsOrFail } from "../settings/getSettings";
import { reportDevicesUsage } from "./devices";
import { processRequest } from "./webhook";
import { createWebhookRequest } from "./webhook-request";

const log = Util.log(`Apple Webhook`);

export const processAppleData = async (
  data: AppleWebhookPayload,
  metriportUserId: string,
  cxId: string
): Promise<void> => {
  try {
    const connectedUser = await getConnectedUserOrFail({ id: metriportUserId, cxId });

    const settings = await getSettingsOrFail({ id: connectedUser.cxId });
    const payload = { users: [{ userId: metriportUserId, ...data }] };
    const webhookRequest = await createWebhookRequest({
      cxId,
      type: "devices.health-data",
      payload,
    });

    await processRequest(webhookRequest, settings);
    reportDevicesUsage(connectedUser.cxId, [connectedUser.cxUserId]);
  } catch (error) {
    log(`Error on processAppleData: ${errorToString(error)}`);
  }
};

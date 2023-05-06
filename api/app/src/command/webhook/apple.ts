import { AppleWebhookPayload } from "../../mappings/apple";
import { capture } from "../../shared/notifications";
import { getConnectedUserOrFail } from "../connected-user/get-connected-user";
import { getSettingsOrFail } from "../settings/getSettings";
import { reportDevicesUsage, processRequest } from "./webhook";
import { createWebhookRequest } from "./webhook-request";
import { Util } from "../../shared/util";

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
    const webhookRequest = await createWebhookRequest({ cxId, payload });

    await processRequest(webhookRequest, settings);
    reportDevicesUsage(connectedUser.cxId, [connectedUser.cxUserId]);
  } catch (err) {
    log(`Error on processAppleData: `, err);
    capture.error(err, {
      extra: { metriportUserId, context: `webhook.processAppleData` },
    });
  }
};

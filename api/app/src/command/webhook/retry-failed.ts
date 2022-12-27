import { WebhookRequest } from "../../models/webhook-request";
import { Util } from "../../shared/util";
import { getSettingsOrFail } from "../settings/getSettings";
import { processRequest } from "./webhook";

export const retryFailedRequests = async (cxId: string): Promise<void> => {
  const settings = await getSettingsOrFail({ id: cxId });

  const failed = await WebhookRequest.findAll({
    where: { cxId, status: ["failure"] },
    order: [["createdAt", "ASC"]],
  });

  // mark all as processing and the process them asynchronously
  await WebhookRequest.update(
    {
      status: "processing",
    },
    {
      where: {
        id: failed.map((f) => f.id),
      },
    }
  );

  // intentionally asynchronous
  new Promise(async () => {
    try {
      for (const request of failed) {
        const success = await processRequest(request, settings);
        // give it some time to prevent flooding the customer
        if (success) await Util.sleep(Math.random() * 200);
      }
    } catch (err) {
      // TODO #156 report to monitoring app instead
      console.log(`Error retrying failed webhook requests`, err);
    }
  });
};

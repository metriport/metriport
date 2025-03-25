import { processAsyncError } from "@metriport/core/util/error/shared";
import { capture } from "@metriport/core/util/notifications";
import { sleep } from "@metriport/shared";
import { WebhookRequest } from "../../models/webhook-request";
import { getSettingsOrFail } from "../settings/getSettings";
import { processRequest } from "./webhook";

export const retryFailedRequests = async (cxId: string): Promise<void> => {
  const settings = await getSettingsOrFail({ id: cxId });

  const failed = await WebhookRequest.findAll({
    where: { cxId, status: ["failure"] },
    order: [["createdAt", "ASC"]],
  });
  if (failed.length < 1) return;

  // mark all as processing and the process them asynchronously
  await WebhookRequest.update(
    {
      status: "processing",
    },
    {
      where: {
        id: failed.map(f => f.id),
      },
    }
  );

  const _processRequest = async () => {
    try {
      for (const request of failed) {
        const success = await processRequest(request, settings);
        // give it some time to prevent flooding the customer
        if (success) await sleep(Math.random() * 200);
      }
    } catch (error) {
      capture.error(error, { extra: { context: `webhook.retryFailedRequests`, error } });
    }
  };
  // intentionally asynchronous
  _processRequest().catch(processAsyncError("Failed retrying failed webhook requests"));
};

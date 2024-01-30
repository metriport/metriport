import dayjs from "dayjs";
import { Op } from "sequelize";
import { WebhookRequest } from "../../../models/webhook-request";

const DAYS_TO_KEEP_WEBHOOK_REQUESTS = 30;

export type WHRequestsCleanupResult = {
  removed: number;
  remaining: number;
};

/**
 * ADMIN ONLY, NOT TO BE CALLED BY REGULAR CODE/USERS.
 */
export async function dbMaintenance(): Promise<{ webhookRequests: WHRequestsCleanupResult }> {
  const webhookRequests = await cleanupWHRequests();
  return { webhookRequests };
}

async function cleanupWHRequests(): Promise<WHRequestsCleanupResult> {
  const removed = await WebhookRequest.destroy({
    where: {
      createdAt: {
        [Op.lt]: dayjs().subtract(DAYS_TO_KEEP_WEBHOOK_REQUESTS, "days").toDate(),
      },
    },
  });
  const remaining = await WebhookRequest.count();
  return {
    removed,
    remaining,
  };
}

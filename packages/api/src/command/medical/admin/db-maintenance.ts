import dayjs from "dayjs";
import { Op } from "sequelize";
import { WebhookRequest } from "../../../models/webhook-request";

const DAYS_TO_KEEP_WEBHOOK_REQUESTS = 30;

/**
 * ADMIN ONLY, NOT TO BE CALLED BY REGULAR CODE/USERS.
 */
export async function dbMaintenance() {
  const whRequestsRemoved = await WebhookRequest.destroy({
    where: {
      createdAt: {
        [Op.lt]: dayjs().subtract(DAYS_TO_KEEP_WEBHOOK_REQUESTS, "days").toDate(),
      },
    },
  });
  const whRequestsRemaining = await WebhookRequest.count();

  return {
    whRequestsRemoved,
    whRequestsRemaining,
  };
}

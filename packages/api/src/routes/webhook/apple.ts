import { Request, Response } from "express";
import Router from "express-promise-router";
import { processAppleData } from "../../command/webhook/apple";
import { appleSchema, mapData } from "../../mappings/apple";
import { asyncHandler, getCxIdOrFail } from "../util";
import { capture } from "@metriport/core/util/notifications";
import { analytics, EventTypes } from "../../shared/analytics";

const routes = Router();
/** ---------------------------------------------------------------------------
 * POST /webhook/apple
 *
 * Receive apple data for all data types for the specified user ID
 *
 */
routes.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const metriportUserId = req.body.metriportUserId;
    const hourly = req.body.hourly;
    const cxId = getCxIdOrFail(req);
    const payload = JSON.parse(req.body.data);

    // TEMP LOGS FOR DEBUGGING
    console.log(metriportUserId, JSON.stringify(payload));

    const key = Object.keys(payload)[0];

    analytics({
      distinctId: cxId,
      event: EventTypes.webhook,
      properties: {
        metriportUserId,
        type: key,
        payload,
      },
    });

    if (payload.error) {
      capture.error(new Error(payload.error), {
        extra: {
          metriportUserId,
          context: `webhook.appleError`,
          ...(payload.extra ? JSON.parse(payload.extra) : {}),
        },
      });
    } else {
      const mappedData = mapData(appleSchema.parse(payload), hourly);
      processAppleData(mappedData, metriportUserId, cxId);
    }

    return res.sendStatus(200);
  })
);

export default routes;

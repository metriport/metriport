import { Request, Response } from "express";
import Router from "express-promise-router";
import { processAppleData } from "../../command/webhook/apple";
import { Product } from "../../domain/product";
import { appleSchema, mapData } from "../../mappings/apple";
import { EventTypes, analytics } from "../../shared/analytics";
import { asyncHandler, getCxIdOrFail } from "../util";

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
      apiType: Product.devices,
    });

    if (!payload.error) {
      const mappedData = mapData(appleSchema.parse(payload), hourly);
      processAppleData(mappedData, metriportUserId, cxId);
    }

    return res.sendStatus(200);
  })
);

export default routes;

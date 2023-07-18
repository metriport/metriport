import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { processData } from "../../command/webhook/fitbit";
import { asyncHandler } from "../util";
import { fitbitWebhookNotificationSchema } from "../../mappings/fitbit";

const routes = Router();

/** ---------------------------------------------------------------------------
 * POST /webhook/fitbit
 *
 * Receive fitbit data for all data types for the specified user ID
 *
 */
routes.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    processData(fitbitWebhookNotificationSchema.parse(req.body));
    return res.sendStatus(status.OK);
  })
);

export default routes;

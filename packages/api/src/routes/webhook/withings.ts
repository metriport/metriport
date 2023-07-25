import { Request, Response } from "express";
import Router from "express-promise-router";
import { asyncHandler } from "../util";
import { processData } from "../../command/webhook/withings";

const routes = Router();
/** ---------------------------------------------------------------------------
 * POST /webhook/withings
 *
 * Receive for all data types for the specified user ID
 *
 */
routes.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    console.log("withings lambda payload:", JSON.stringify(req.body));
    processData(req.body);
    return res.sendStatus(200);
  })
);

/** ---------------------------------------------------------------------------
 * HEAD /webhook/withings
 *
 * Confirm that the webhook was successfully connected
 *
 */
routes.head(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    return res.sendStatus(200);
  })
);

export default routes;

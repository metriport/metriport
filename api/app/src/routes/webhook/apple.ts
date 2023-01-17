import { Request, Response } from "express";
import Router from "express-promise-router";

import { asyncHandler } from "../util";
import { mapData } from "../../mappings/apple";
import { processAppleData } from "../../command/webhook/webhook";

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
    const payload = JSON.parse(req.body.data);

    const mappedData = mapData(payload)

    processAppleData(mappedData, metriportUserId)

    return res.sendStatus(200);
  })
);

export default routes;

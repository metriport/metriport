import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { asyncHandler } from "../util";
import { tenoviMeasurementSchema } from "../../mappings/tenovi";
import { processMeasurementData } from "../../command/webhook/tenovi";

const routes = Router();

/** ---------------------------------------------------------------------------
 * POST /webhook/tenovi
 *
 * Receive and process Tenovi Measurements
 *
 */
routes.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    processMeasurementData(tenoviMeasurementSchema.parse(req.body));
    return res.sendStatus(status.OK);
  })
);

export default routes;

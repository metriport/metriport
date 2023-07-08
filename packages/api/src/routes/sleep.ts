import { Sleep } from "@metriport/api-sdk";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { ConsumerHealthDataType } from "../providers/provider";
import { getProviderDataForType } from "./helpers/provider-route-helper";
import { asyncHandler } from "./util";
const router = Router();

/** ---------------------------------------------------------------------------
 * GET /sleep
 *
 * Gets sleep data for all connected providers for the specified user ID
 * and date.
 *
 * @param   {string}        req.query.userId  The user ID.
 * @param   {string}        req.query.date    Date to fetch data for.
 *
 * @return  {Sleep[]}   The user's sleep data.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const results = await getProviderDataForType<Sleep>(req, ConsumerHealthDataType.Sleep);

    res.status(status.OK).json(results);
  })
);

export default router;

import { Body } from "@metriport/api-sdk";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { ConsumerHealthDataType } from "../providers/provider";
import { getProviderDataForType } from "./helpers/provider-route-helper";
import { asyncHandler } from "./util";
const router = Router();

/** ---------------------------------------------------------------------------
 * GET /body
 *
 * Gets body data for all connected providers for the specified user ID
 * and date.
 *
 * @param   {string}        req.query.userId  The user ID.
 * @param   {string}        req.query.date    Date to fetch data for.
 *
 * @return  {Body[]}   The user's body data.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const results = await getProviderDataForType<Body>(req, ConsumerHealthDataType.Body);

    res.status(status.OK).json(results);
  })
);

export default router;

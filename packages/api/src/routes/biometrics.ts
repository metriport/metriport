import { Biometrics } from "@metriport/api-sdk";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { ConsumerHealthDataType } from "../providers/provider";
import { getProviderDataForType } from "./helpers/provider-route-helper";
import { asyncHandler } from "./util";
import { deprecateAllRoutes } from "./middlewares/deprecate-routes";

const router = Router();
router.use(deprecateAllRoutes);

/** ---------------------------------------------------------------------------
 * GET /biometrics
 *
 * Gets biometrics data for all connected providers for the specified user ID
 * and date.
 *
 * @param   {string}        req.query.userId  The user ID.
 * @param   {string}        req.query.date    Date to fetch data for.
 *
 * @return  {Body[]}   The user's biometrics data.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const results = await getProviderDataForType<Biometrics>(
      req,
      ConsumerHealthDataType.Biometrics
    );

    res.status(status.OK).json(results);
  })
);

export default router;

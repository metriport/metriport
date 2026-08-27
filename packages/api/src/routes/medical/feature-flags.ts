import { getFrontendIntendedFFsMapped } from "@metriport/core/command/feature-flags/frontend-intended-ffs";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getCxIdOrFail } from "../util";

const router = Router();

/** ---------------------------------------------------------------------------
 * GET /feature-flags
 *
 * Get Frontend intended feature flags that are **actively enabled** for the CX.
 * @return 200 Active feature flags.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    return res.status(httpStatus.OK).json(await getFrontendIntendedFFsMapped(cxId));
  })
);

export default router;

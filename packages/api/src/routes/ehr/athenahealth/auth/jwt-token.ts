import Router from "express-promise-router";
import { Request, Response } from "express";
import { requestLogger } from "../../../helpers/request-logger";
import { EhrSources } from "../../../../external/ehr/shared";
import { asyncHandler, checkJwtToken, saveJwtToken } from "../../../util";

const router = Router();

/**
 * GET /internal/token/athenahealth
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    return await checkJwtToken({
      source: EhrSources.ATHENA,
      req,
      res,
    });
  })
);

/**
 * POST/internal/token/athenahealth
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    return await saveJwtToken({
      source: EhrSources.ATHENA,
      req,
      res,
    });
  })
);

export default router;

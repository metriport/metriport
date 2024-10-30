import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { requestLogger } from "../../../helpers/request-logger";
import { checkJwtToken, saveJwtToken, createJwtSchema } from "../../../../external/ehr/jwt-token";
import { EhrSources } from "../../../../external/ehr/shared";
import { asyncHandler, getAuthorizationToken } from "../../../util";

const router = Router();

/**
 * GET /internal/token/athenahealth
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const tokenStatus = await checkJwtToken({
      token,
      source: EhrSources.athena,
    });
    return res.status(httpStatus.OK).json(tokenStatus);
  })
);

/**
 * POST/internal/token/athenahealth
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const data = createJwtSchema.parse(req.body);
    await saveJwtToken({
      token,
      source: EhrSources.athena,
      data,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;

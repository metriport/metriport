import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { requestLogger } from "../../../helpers/request-logger";
import { checkJwtToken, createJwtSchema, saveJwtToken } from "../../../../external/ehr/jwt-token";
import { EhrSources } from "../../../../external/ehr/shared";
import { asyncHandler, getAuthorizationToken } from "../../../util";

const router = Router();

/**
 * GET /internal/token/canvas
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const tokenStatus = await checkJwtToken({
      token,
      source: EhrSources.canvas,
    });
    return res.status(httpStatus.OK).json(tokenStatus);
  })
);

/**
 * POST /internal/token/canvas
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const data = createJwtSchema.parse(req.body);
    data.data.source = EhrSources.canvas;
    await saveJwtToken({
      token,
      source: EhrSources.canvas,
      data,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;

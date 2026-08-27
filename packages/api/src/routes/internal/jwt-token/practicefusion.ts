import {
  practicefusionRefreshJwtTokenDataSchema,
  practicefusionRefreshSource,
  practicefusionDashJwtTokenDataSchema,
  practicefusionDashSource,
} from "@metriport/shared/interface/external/ehr/practicefusion/jwt-token";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import z from "zod";
import { checkJwtToken, saveJwtToken } from "../../../external/ehr/shared/utils/jwt-token";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getAuthorizationToken } from "../../util";

const router = Router();

/**
 * GET /internal/token/practicefusion
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const tokenStatus = await checkJwtToken({
      token,
      source: practicefusionDashSource,
    });
    return res.status(httpStatus.OK).json(tokenStatus);
  })
);

const createJwtSchema = z.object({
  exp: z.number(),
  data: practicefusionDashJwtTokenDataSchema,
});

/**
 * POST /internal/token/practicefusion
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const data = createJwtSchema.parse(req.body);
    await saveJwtToken({
      token,
      source: practicefusionDashSource,
      ...data,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

const createClientJwtSchema = z.object({
  exp: z.number(),
  data: practicefusionRefreshJwtTokenDataSchema,
});

/**
 * POST /internal/token/practicefusion/refresh
 *
 * Save a refresh token for background processing (24hr appointments, auto write back, etc).
 * Refresh token has a 1-year lifespan.
 */
router.post(
  "/refresh",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const data = createClientJwtSchema.parse(req.body);
    await saveJwtToken({
      token,
      source: practicefusionRefreshSource,
      ...data,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;

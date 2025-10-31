import {
  epicDashJwtTokenDataSchema,
  epicDashSource,
} from "@metriport/shared/interface/external/ehr/epic/jwt-token";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import z from "zod";
import { checkJwtToken, saveJwtToken } from "../../../external/ehr/shared/utils/jwt-token";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getAuthorizationToken } from "../../util";

const router = Router();

/**
 * GET /internal/token/epic
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const tokenStatus = await checkJwtToken({
      token,
      source: epicDashSource,
    });
    return res.status(httpStatus.OK).json(tokenStatus);
  })
);

const createJwtSchema = z.object({
  exp: z.number(),
  data: epicDashJwtTokenDataSchema,
});

/**
 * POST /internal/token/epic
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const data = createJwtSchema.parse(req.body);
    await saveJwtToken({
      token,
      source: epicDashSource,
      ...data,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;

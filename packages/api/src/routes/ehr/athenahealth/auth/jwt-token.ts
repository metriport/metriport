import { EhrSources } from "@metriport/core/external/shared/ehr";
import { athenaJwtTokenDataSchema } from "@metriport/shared/interface/external/athenahealth/jwt-token";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import z from "zod";
import { checkJwtToken, saveJwtToken } from "../../../../external/ehr/jwt-token";
import { requestLogger } from "../../../helpers/request-logger";
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

const createJwtSchema = z.object({
  exp: z.number(),
  data: athenaJwtTokenDataSchema,
});

/**
 * POST /internal/token/athenahealth
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
      ...data,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;

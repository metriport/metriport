import { elationJwtTokenDataSchema } from "@metriport/shared/interface/external/elation/jwt-token";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import z from "zod";
import { checkJwtToken, saveJwtToken } from "../../../../external/ehr/jwt-token";
import { EhrSources } from "../../../../external/ehr/shared";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler, getAuthorizationToken } from "../../../util";

const router = Router();

/**
 * GET /internal/token/elation
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const tokenStatus = await checkJwtToken({
      token,
      source: EhrSources.elation,
    });
    return res.status(httpStatus.OK).json(tokenStatus);
  })
);

const createJwtSchema = z.object({
  exp: z.number(),
  data: elationJwtTokenDataSchema,
});

/**
 * POST /internal/token/elation
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const data = createJwtSchema.parse(req.body);
    await saveJwtToken({
      token,
      source: EhrSources.elation,
      ...data,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;

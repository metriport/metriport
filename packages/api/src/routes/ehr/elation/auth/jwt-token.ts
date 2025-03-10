import { elationWebhookJwtTokenDataSchema } from "@metriport/shared/interface/external/elation/jwt-token";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import z from "zod";
import { elationWebhookJwtTokenSource } from "../../../../external/ehr/elation/shared";
import { checkJwtToken, saveJwtToken } from "../../../../external/ehr/jwt-token";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler, getAuthorizationToken } from "../../../util";

const router = Router();

/**
 * GET /internal/token/elation/webhook
 */
router.get(
  "/webhook",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const tokenStatus = await checkJwtToken({
      token,
      source: elationWebhookJwtTokenSource,
    });
    return res.status(httpStatus.OK).json(tokenStatus);
  })
);

const createWebhookJwtSchema = z.object({
  exp: z.number(),
  data: elationWebhookJwtTokenDataSchema,
});

/**
 * POST /internal/token/elation/webhook
 */
router.post(
  "/webhook",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const data = createWebhookJwtSchema.parse(req.body);
    await saveJwtToken({
      token,
      source: elationWebhookJwtTokenSource,
      ...data,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;

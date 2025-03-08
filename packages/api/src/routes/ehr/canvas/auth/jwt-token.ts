import {
  canvasJwtTokenDataSchema,
  canvasWebhookJwtTokenDataSchema,
} from "@metriport/shared/interface/external/canvas/jwt-token";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import z from "zod";
import { canvasWebhookJwtTokenSource } from "../../../../external/ehr/canvas/shared";
import { checkJwtToken, saveJwtToken } from "../../../../external/ehr/jwt-token";
import { EhrSources } from "../../../../external/ehr/shared";
import { requestLogger } from "../../../helpers/request-logger";
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
 * GET /internal/token/canvas/webhook
 */
router.get(
  "/webhook",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const tokenStatus = await checkJwtToken({
      token,
      source: canvasWebhookJwtTokenSource,
    });
    return res.status(httpStatus.OK).json(tokenStatus);
  })
);

const createJwtSchema = z.object({
  exp: z.number(),
  data: canvasJwtTokenDataSchema,
});

/**
 * POST /internal/token/canvas
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const data = createJwtSchema.parse(req.body);
    await saveJwtToken({
      token,
      source: EhrSources.canvas,
      ...data,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

const createWebhookJwtSchema = z.object({
  exp: z.number(),
  data: canvasWebhookJwtTokenDataSchema,
});

/**
 * POST /internal/token/canvas/webhook
 */
router.post(
  "/webhook",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const data = createWebhookJwtSchema.parse(req.body);
    await saveJwtToken({
      token,
      source: canvasWebhookJwtTokenSource,
      ...data,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;

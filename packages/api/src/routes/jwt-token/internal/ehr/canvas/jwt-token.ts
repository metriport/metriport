import {
  canvasDashJwtTokenDataSchema,
  canvasDashSource,
  canvasWebhookJwtTokenDataSchema,
  canvasWebhookSource,
} from "@metriport/shared/interface/external/ehr/canvas/jwt-token";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import z from "zod";
import { checkJwtToken, saveJwtToken } from "../../../../../external/ehr/jwt-token";
import { requestLogger } from "../../../../helpers/request-logger";
import { asyncHandler, getAuthorizationToken } from "../../../../util";

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
      source: canvasDashSource,
    });
    return res.status(httpStatus.OK).json(tokenStatus);
  })
);

const createJwtSchema = z.object({
  exp: z.number(),
  data: canvasDashJwtTokenDataSchema,
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
      source: canvasDashSource,
      ...data,
    });
    return res.sendStatus(httpStatus.OK);
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
      source: canvasWebhookSource,
    });
    return res.status(httpStatus.OK).json(tokenStatus);
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
      source: canvasWebhookSource,
      ...data,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;

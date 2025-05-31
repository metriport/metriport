import { BadRequestError } from "@metriport/shared/dist/error/bad-request";
import { isEhrSource } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import {
  checkJwtToken,
  getDashJwtTokenDataSchema,
  getWebhookJwtTokenDataSchema,
  saveJwtToken,
} from "../../../external/ehr/shared/utils/jwt-token";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getAuthorizationToken, getFromQueryOrFail } from "../../util";
import z from "zod";

const router = Router();

/**
 * GET /internal/token/:ehrId
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const [source] = getDashJwtTokenDataSchema(ehr);
    const tokenStatus = await checkJwtToken({ token, source });
    return res.status(httpStatus.OK).json(tokenStatus);
  })
);

/**
 * POST /internal/token/:ehrId
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const [source, schema] = getDashJwtTokenDataSchema(ehr);
    const createJwtSchema = z.object({ exp: z.number(), data: schema });
    const data = createJwtSchema.parse(req.body);
    await saveJwtToken({ token, source, ...data });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * GET /internal/token/:ehrId/webhook
 */
router.get(
  "/webhook",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const [source] = getWebhookJwtTokenDataSchema(ehr);
    const tokenStatus = await checkJwtToken({ token, source });
    return res.status(httpStatus.OK).json(tokenStatus);
  })
);

/**
 * POST /internal/token/:ehrId/webhook
 */
router.post(
  "/webhook",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getAuthorizationToken(req);
    const ehr = getFromQueryOrFail("ehrId", req);
    if (!isEhrSource(ehr)) throw new BadRequestError("Invalid EHR", undefined, { ehr });
    const [source, schema] = getWebhookJwtTokenDataSchema(ehr);
    const createJwtSchema = z.object({ exp: z.number(), data: schema });
    const data = createJwtSchema.parse(req.body);
    await saveJwtToken({ token, source, ...data });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;

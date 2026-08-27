import {
  createEmbedTokenSchema,
  maxExpirationSeconds,
} from "@metriport/shared/interface/external/ehr/embed/jwt-token";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { createEmbedToken } from "../../command/embed/create-embed-token";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getCxIdOrFail } from "../util";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /medical/v1/token/embed
 *
 * Generates an embed token.
 *
 * @param req.body.expirationInSeconds Optional expiration time in seconds (max 36000 = 10 hours, default 10 hours).
 * @returns Access token.
 */
router.post(
  "/embed",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const { expirationInSeconds = maxExpirationSeconds } = createEmbedTokenSchema.parse(req.body);
    const data = await createEmbedToken({ cxId, expirationInSeconds });
    return res.status(httpStatus.OK).json(data);
  })
);

export default router;

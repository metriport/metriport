import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { elationWebhookJwtTokenSource } from "../../../../external/ehr/elation/shared";
import { checkJwtToken } from "../../../../external/ehr/jwt-token";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler, getAuthorizationToken } from "../../../util";

const router = Router();

/**
 * GET /internal/token/elation-webhook
 */
router.get(
  "/elation-webhook",
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

export default router;

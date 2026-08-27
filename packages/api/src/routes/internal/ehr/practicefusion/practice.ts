import { MetriportError } from "@metriport/shared";
import {
  practicefusionRefreshJwtTokenDataSchema,
  practicefusionRefreshSource,
} from "@metriport/shared/interface/external/ehr/practicefusion/jwt-token";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getLatestExpiringJwtTokenBySourceAndPartialData } from "../../../../command/jwt-token";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler, getFrom } from "../../../util";

const router = Router();

/**
 * GET /internal/ehr/practicefusion/practice/:id/refresh-token
 *
 * Get the refresh token for the practice (stored after user authorization from UI)
 *
 * @param req.params.id - The practice id of the EHR integration.
 * @returns The refresh token for the practice
 */
router.get(
  "/:id/refresh-token",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const practiceId = getFrom("params").orFail("id", req);
    const storedToken = await getLatestExpiringJwtTokenBySourceAndPartialData({
      source: practicefusionRefreshSource,
      data: { practiceId },
    });
    if (!storedToken) {
      throw new MetriportError(
        "PracticeFusion no token found, user must authorize first from UI",
        undefined,
        { practiceId }
      );
    }
    const tokenData = practicefusionRefreshJwtTokenDataSchema.safeParse(storedToken.data);
    if (!tokenData.success) {
      throw new MetriportError("Invalid PracticeFusion token data format", undefined, {
        practiceId,
        error: tokenData.error.message,
      });
    }
    return res.status(httpStatus.OK).json({
      refreshToken: tokenData.data.refreshToken,
    });
  })
);

export default router;

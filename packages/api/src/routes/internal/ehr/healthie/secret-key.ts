import { BadRequestError } from "@metriport/shared";
import { isSubscriptionResource } from "@metriport/shared/interface/external/ehr/healthie/subscription";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getHealthieSecretKeyInfo } from "../../../../external/ehr/healthie/shared";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler, getFromQueryOrFail } from "../../../util";

const router = Router();

/**
 * GET /internal/ehr/healthie/secret-key
 *
 * Tries to retrieve the secret key for the given practiceId and resource
 * @param req.query.practiceId The ID of the Healthie practice.
 * @param req.query.resource The subscription resource type.
 * @returns The secret key.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const practiceId = getFromQueryOrFail("practiceId", req);
    const resource = getFromQueryOrFail("resource", req);
    if (!isSubscriptionResource(resource)) {
      throw new BadRequestError("Invalid resource", undefined, { resource });
    }
    const secretKey = await getHealthieSecretKeyInfo(practiceId, resource);
    return res.status(httpStatus.OK).json({ ...secretKey });
  })
);

export default router;

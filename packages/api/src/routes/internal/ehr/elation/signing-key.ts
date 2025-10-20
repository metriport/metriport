import { BadRequestError } from "@metriport/shared";
import { isSubscriptionResource } from "@metriport/shared/interface/external/ehr/elation/subscription";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getElationSigningKeyInfo } from "../../../../external/ehr/elation/shared";
import { requestLogger } from "../../../helpers/request-logger";
import { asyncHandler, getFromQueryOrFail } from "../../../util";

const router = Router();

/**
 * GET /internal/ehr/elation/signing-key
 *
 * Tries to retrieve the signing key for the given applicationId and resource
 * @param req.query.applicationId The ID of the Elation application.
 * @param req.query.resource The subscription resource type.
 * @returns The signing key.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = getFromQueryOrFail("applicationId", req);
    const resource = getFromQueryOrFail("resource", req);
    if (!isSubscriptionResource(resource)) {
      throw new BadRequestError("Invalid resource", undefined, { resource });
    }
    const signingKey = await getElationSigningKeyInfo(applicationId, resource);
    return res.status(httpStatus.OK).json({ signingKey });
  })
);

export default router;

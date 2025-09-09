import {
  canvasDashSource,
  canvasWebhookSource,
} from "@metriport/shared/interface/external/ehr/canvas/jwt-token";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import dayjs from "dayjs";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { nanoid } from "nanoid";
import { updateCustomerBillingToPointToParent } from "../../../../command/internal-server/update-customer";
import { findOrCreateCxMapping } from "../../../../command/mapping/cx";
import { findOrCreateFacilityMapping } from "../../../../command/mapping/facility";
import { saveJwtToken } from "../../../../external/ehr/shared/utils/jwt-token";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler, getFromQueryAsBoolean, getFromQueryOrFail } from "../../../util";

const router = Router();

function generateToken(): string {
  return nanoid(30);
}

function getDefaultExpiration(): number {
  return dayjs().add(2, "year").valueOf();
}

/**
 * POST /internal/ehr/canvas/setup
 *
 * Setup a new cx in Canvas
 * @param req.query.cxId - The customer ID
 * @param req.query.facilityId - The facility ID
 * @param req.query.externalId - The external ID
 * @param req.query.isTenant - Whether this is a tenant of the main Canvas cx (defaults to true)
 * @returns 200 OK with the dash and webhook tokens
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getUUIDFrom("query", req, "facilityId").orFail();
    const externalId = getFromQueryOrFail("externalId", req);
    const isTenant = getFromQueryAsBoolean("isTenant", req) ?? true;

    // Only update billing if this is a tenant of the main Canvas cx
    if (isTenant) {
      await updateCustomerBillingToPointToParent({
        parentName: EhrSources.canvas,
        childCxId: cxId,
      });
    }

    await findOrCreateFacilityMapping({ cxId, facilityId, externalId, source: EhrSources.canvas });

    await findOrCreateCxMapping({
      cxId,
      source: EhrSources.canvas,
      externalId,
      secondaryMappings: {},
    });

    const dashToken = generateToken();
    const webhookToken = generateToken();
    const twoYearsFromNow = getDefaultExpiration();

    await Promise.all([
      saveJwtToken({
        token: dashToken,
        source: canvasDashSource,
        exp: twoYearsFromNow,
        data: {
          source: canvasDashSource,
          practiceId: externalId,
        },
      }),
      saveJwtToken({
        token: webhookToken,
        source: canvasWebhookSource,
        exp: twoYearsFromNow,
        data: {
          cxId,
          source: canvasWebhookSource,
          practiceId: externalId,
        },
      }),
    ]);

    // TODO: ENG-877 - Update AWS secrets within endpoint for Canvas cx setup
    // Place these tokens in a secure note in 1PW
    return res.status(httpStatus.OK).json({ dashToken, webhookToken });
  })
);

export default router;

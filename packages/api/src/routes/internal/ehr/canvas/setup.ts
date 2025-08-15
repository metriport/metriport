import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import z from "zod";
import { updateCustomerBillingToPointToParent } from "../../../../command/internal-server/update-customer";
import { findOrCreateFacilityMapping } from "../../../../command/mapping/facility";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler, getFromQuery, getFromQueryOrFail } from "../../../util";
import { findOrCreateCxMapping } from "../../../../command/mapping/cx";
import { saveJwtToken } from "../../../../external/ehr/shared/utils/jwt-token";
import {
  canvasDashSource,
  canvasWebhookSource,
} from "@metriport/shared/interface/external/ehr/canvas/jwt-token";
import ForbiddenError from "../../../../errors/forbidden";

const router = Router();

const setupCanvasSchema = z.object({
  dashToken: z.object({
    token: z.string(),
    exp: z.number(),
  }),
  webhookToken: z.object({
    token: z.string(),
    exp: z.number(),
  }),
});

/**
 * POST /internal/ehr/canvas/setup
 *
 * Setup a new cx in Canvas
 * @param req.query.childCxId - The child customer's ID
 * @param req.query.facilityId - The facility ID
 * @param req.query.externalId - The external ID
 * @param req.query.state - The state of the facility
 * @param req.body - The JWT token data
 * @returns 200 OK
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const childCxId = getUUIDFrom("query", req, "childCxId").orFail();
    const facilityId = getUUIDFrom("query", req, "facilityId").orFail();
    const externalId = getFromQueryOrFail("externalId", req);
    const state = getFromQuery("state", req);

    const token = setupCanvasSchema.parse(req.body).dashToken;
    const webhookToken = setupCanvasSchema.parse(req.body).webhookToken;

    if (token.token === "" || webhookToken.token === "") throw new ForbiddenError();

    await updateCustomerBillingToPointToParent({ parentName: canvasDashSource, childCxId });

    const externalIdWithState = state ? `${externalId}-${state}` : externalId;

    await findOrCreateFacilityMapping({
      cxId: childCxId,
      facilityId: facilityId,
      externalId: externalIdWithState,
      source: canvasDashSource,
    });

    await findOrCreateCxMapping({
      cxId: childCxId,
      source: canvasDashSource,
      externalId: externalId,
      secondaryMappings: null,
    });

    await Promise.all([
      saveJwtToken({
        token: token.token,
        source: canvasDashSource,
        exp: token.exp,
        data: {
          source: canvasDashSource,
          practiceId: externalId,
        },
      }),
      saveJwtToken({
        token: webhookToken.token,
        source: canvasWebhookSource,
        exp: webhookToken.exp,
        data: {
          cxId: childCxId,
          source: canvasWebhookSource,
          practiceId: externalId,
        },
      }),
    ]);

    return res.sendStatus(httpStatus.OK);
  })
);

export default router;

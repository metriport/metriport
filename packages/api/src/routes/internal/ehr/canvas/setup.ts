import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { updateCustomerBillingToPointToParent } from "../../../../command/internal-server/update-customer";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler, getFromQueryOrFail } from "../../../util";

const router = Router();

/**
 * POST /internal/ehr/canvas/setup
 *
 * Updates customer billing to point to parent organization
 * @param req.query.parentName - The parent customer's name
 * @param req.query.childCxId - The child customer's ID
 * @returns 200 OK
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const parentName = getFromQueryOrFail("parentName", req);
    const childCxId = getUUIDFrom("query", req, "childCxId").orFail();

    await updateCustomerBillingToPointToParent({ parentName, childCxId });

    // ALEXEY TODO: the rest of the setup here...

    return res.sendStatus(httpStatus.OK);
  })
);

export default router;

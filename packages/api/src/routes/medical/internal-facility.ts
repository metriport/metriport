import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { deleteFacility } from "../../command/medical/facility/delete-facility";
import { asyncHandler, getCxIdFromQueryOrFail, getFromParamsOrFail } from "../util";

const router = Router();

/** ---------------------------------------------------------------------------
 * DELETE /internal/facility/:id
 *
 * Deletes the facility corresponding to the customer ID and facility id.
 *
 * @returns 200 OK.
 */
router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdFromQueryOrFail(req);
    const facilityId = getFromParamsOrFail("id", req);

    await deleteFacility({ cxId, id: facilityId });

    return res.sendStatus(status.OK);
  })
);

export default router;

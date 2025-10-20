import { NotFoundError } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { deleteFacility } from "../../command/medical/facility/delete-facility";
import { getFacilities } from "../../command/medical/facility/get-facility";
import { updateFacility } from "../../command/medical/facility/update-facility";
import { getETag } from "../../shared/http";
import { requestLogger } from "../helpers/request-logger";
import { getFacilityInfoOrFail } from "../middlewares/facility-authorization";
import { asyncHandler } from "../util";
import { dtoFromModel } from "./dtos/facilityDTO";
import { facilityUpdateSchema } from "./schemas/facility";

const router = Router();

/** ---------------------------------------------------------------------------
 * PUT /facility/:id
 *
 * Updates a facility.
 *
 * @return {FacilityDTO} The updated facility.
 */
router.put(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, id: facilityId } = getFacilityInfoOrFail(req);
    const facilityData = facilityUpdateSchema.parse(req.body);

    const facility = await updateFacility({
      data: {
        ...facilityData,
        tin: facilityData.tin ?? undefined,
        active: facilityData.active ?? undefined,
      },
      ...getETag(req),
      id: facilityId,
      cxId,
    });

    return res.status(status.OK).json(dtoFromModel(facility));
  })
);

/** ---------------------------------------------------------------------------
 * GET /facility/:id
 *
 * Return a facility.
 *
 * @return {FacilityDTO} The facility.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, id: facilityId } = getFacilityInfoOrFail(req);

    const facilities = await getFacilities({ cxId, ids: [facilityId] });
    if (facilities.length < 1) throw new NotFoundError(`No facility found`);

    return res.status(status.OK).json(dtoFromModel(facilities[0]));
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /facility/:id
 *
 * Removes a facility if there are no patients associated with it.
 *
 * @return 204 if successful.
 */
router.delete(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, id: facilityId } = getFacilityInfoOrFail(req);

    await deleteFacility({ cxId, id: facilityId });
    return res.sendStatus(status.NO_CONTENT);
  })
);

export default router;

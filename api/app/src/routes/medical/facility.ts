import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createFacility } from "../../command/medical/facility/create-facility";
import { getFacilities } from "../../command/medical/facility/get-facility";
import { updateFacility } from "../../command/medical/facility/update-facility";
import NotFoundError from "../../errors/not-found";
import { asyncHandler, getCxIdOrFail, getFromParamsOrFail } from "../util";
import { dtoFromModel } from "./dtos/facilityDTO";
import { facilitySchema } from "./schemas/facility";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /facility
 *
 * Creates a new facility.
 *
 * @return {FacilityDTO} The facility.
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityData = facilitySchema.parse(req.body);

    const facility = await createFacility({
      cxId,
      data: facilityData,
    });

    return res.status(status.CREATED).json(dtoFromModel(facility));
  })
);

/** ---------------------------------------------------------------------------
 * PUT /facility/:id
 *
 * Updates a facility.
 *
 * @return {FacilityDTO} The updated facility.
 */
router.put(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityId = getFromParamsOrFail("id", req);
    const facilityData = facilitySchema.parse(req.body);

    const facility = await updateFacility({
      id: facilityId,
      cxId,
      data: facilityData,
    });

    return res.status(status.OK).json(dtoFromModel(facility));
  })
);

/** ---------------------------------------------------------------------------
 * GET /facility
 *
 * Gets all of the facilities associated with this account.
 *
 * @return {FacilityDTO} The list of facilities.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);

    const facilities = await getFacilities({ cxId });

    const facilitiesData = facilities.map(dtoFromModel);
    return res.status(status.OK).json({ facilities: facilitiesData });
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
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityId = getFromParamsOrFail("id", req);

    const facilities = await getFacilities({ cxId, ids: [facilityId] });
    if (facilities.length < 1) throw new NotFoundError(`No facility found`);

    return res.status(status.OK).json(dtoFromModel(facilities[0]));
  })
);

export default router;

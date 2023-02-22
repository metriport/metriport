import { Request, Response } from "express";
import Router from "express-promise-router";
import { asyncHandler, getCxIdOrFail } from "../util";
const router = Router();
import status from "http-status";
import { Facility } from "../../models/medical/facility";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { createFacility } from "../../command/medical/facility/create-facility";
import { updateFacility } from "../../command/medical/facility/update-facility";
import { getFacilities } from "../../command/medical/facility/get-facility";

/** ---------------------------------------------------------------------------
 * POST /facility
 *
 * Updates or creates the facility if it doesn't exist already.
 *
 * @return  {Facility}  The facility.
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);

    // TODO: parse this into model
    const facilityData = req.body;

    let facility: Facility;
    if (facilityData.id) {
      const data = { ...facilityData };
      delete data.id;
      facility = await updateFacility({
        id: facilityData.id,
        cxId,
        data,
      });
    } else {
      const org = await getOrganizationOrFail({ cxId });
      facility = await createFacility({
        cxId,
        data: facilityData,
        organizationNumber: org.organizationNumber,
      });
    }

    return res.status(status.OK).json({ id: facility.id, ...facility.data });
  })
);

/** ---------------------------------------------------------------------------
 * GET /facility
 *
 * Gets all of the facilities corresponding to the customer.
 *
 * @return  {Facility[]}  The facilities.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilities = await getFacilities({ cxId });
    const facilitiesData = facilities.map(facility => {
      return { id: facility.id, ...facility.data };
    });

    return res.status(status.OK).json({ facilities: facilitiesData });
  })
);

export default router;

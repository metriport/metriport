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
    const org = await getOrganizationOrFail({ cxId });

    // TODO: parse this into model
    const facilityData = req.body;

    let facility: Facility;
    if (facilityData.id) {
      const data = { ...facilityData };
      delete data.id;
      delete data.facilityId;
      facility = await updateFacility({
        id: facilityData.id,
        cxId,
        organizationId: org.organizationId,
        data,
      });
    } else {
      facility = await createFacility({
        cxId,
        data: facilityData,
        organizationId: org.organizationId,
      });
    }

    return res
      .status(status.OK)
      .json({ id: facility.id, facilityId: facility.facilityId, ...facility.data });
  })
);

/** ---------------------------------------------------------------------------
 * GET /facility
 *
 * Gets all of the facilities corresponding to the customer's organization.
 *
 * @return  {Facility[]}  The facilities.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const org = await getOrganizationOrFail({ cxId });
    const facilities = await getFacilities({ cxId, organizationId: org.organizationId });
    const facilitiesData = facilities.map(facility => {
      return { id: facility.id, facilityId: facility.facilityId, ...facility.data };
    });

    return res.status(status.OK).json({ facilities: facilitiesData });
  })
);

export default router;

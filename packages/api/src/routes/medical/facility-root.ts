import { FacilityType } from "@metriport/core/domain/facility";
import { BadRequestError, OrganizationBizType, TreatmentType } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createFacility } from "../../command/medical/facility/create-facility";
import { getFacilities } from "../../command/medical/facility/get-facility";
import { createOrganization } from "../../command/medical/organization/create-organization";
import { getOrganization } from "../../command/medical/organization/get-organization";
import { Config } from "../../shared/config";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getCxIdOrFail } from "../util";
import { dtoFromModel } from "./dtos/facilityDTO";
import { facilityCreateSchema } from "./schemas/facility";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /facility
 *
 * Creates a new facility with type set to initiatorAndResponder.
 * Note: initiatorOnly facility creation is reserved for internal use.
 *
 * @deprecated
 * @return {FacilityDTO} The facility.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityData = facilityCreateSchema.parse(req.body);
    const existingOrg = await getOrganization({ cxId });
    if (existingOrg?.type === OrganizationBizType.healthcareITVendor) {
      throw new BadRequestError("IT vendors cannot create facilities. Please contact support.");
    }

    if (Config.isSandbox()) {
      if (!existingOrg) {
        await createOrganization({
          cxId,
          data: {
            name: facilityData.name,
            type: TreatmentType.ambulatory,
            location: facilityData.address,
          },
        });
      }
    }

    const facility = await createFacility({
      cxId,
      type: FacilityType.initiatorAndResponder,
      data: {
        ...facilityData,
        tin: facilityData.tin ?? undefined,
        active: facilityData.active ?? undefined,
      },
    });

    return res.status(status.CREATED).json(dtoFromModel(facility));
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
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);

    const facilities = await getFacilities({ cxId });

    const facilitiesData = facilities.map(dtoFromModel);
    return res.status(status.OK).json({ facilities: facilitiesData });
  })
);

export default router;

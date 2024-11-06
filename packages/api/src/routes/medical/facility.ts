import NotFoundError from "@metriport/core/util/error/not-found";
import { OrgType } from "@metriport/core/domain/organization";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { deleteFacility } from "../../command/medical/facility/delete-facility";
import { getFacilities } from "../../command/medical/facility/get-facility";
import { updateFacility } from "../../command/medical/facility/update-facility";
import { createFacility } from "../../command/medical/facility/create-facility";
import { getETag } from "../../shared/http";
import { requestLogger } from "../helpers/request-logger";
import { getFacilityInfoOrFail } from "../middlewares/facility-authorization";
import { asyncHandler, getCxIdOrFail } from "../util";
import { dtoFromModel } from "./dtos/facilityDTO";
import { facilityUpdateSchema } from "./schemas/facility";
import { facilityAuthorization } from "../middlewares/facility-authorization";
import { Config } from "../../shared/config";
import { facilityCreateSchema } from "./schemas/facility";
import { getOrganization } from "../../command/medical/organization/get-organization";
import { createOrganization } from "../../command/medical/organization/create-organization";

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
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const facilityData = facilityCreateSchema.parse(req.body);

    if (Config.isSandbox()) {
      const existingOrg = await getOrganization({ cxId });
      if (!existingOrg) {
        await createOrganization({
          cxId,
          data: {
            name: facilityData.name,
            type: OrgType.ambulatory,
            location: facilityData.address,
          },
        });
      }
    }

    const facility = await createFacility({
      cxId,
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

/** ---------------------------------------------------------------------------
 * PUT /facility/:id
 *
 * Updates a facility.
 *
 * @return {FacilityDTO} The updated facility.
 */
router.put(
  "/:id",
  facilityAuthorization("params"),
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
  "/:id",
  facilityAuthorization("params"),
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
  "/:id",
  facilityAuthorization("params"),
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, id: facilityId } = getFacilityInfoOrFail(req);

    await deleteFacility({ cxId, id: facilityId });
    return res.sendStatus(status.NO_CONTENT);
  })
);

export default router;

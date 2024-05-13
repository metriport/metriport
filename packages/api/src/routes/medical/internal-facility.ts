import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { requestLogger } from "../helpers/request-logger";
import {
  facilityDetailsSchemaBase,
  facilityOboDetailsSchema,
} from "../../domain/medical/internal-facility";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler } from "../util";
import {
  registerOBOFacilityWithHIEs,
  registerNonOBOFacilityWithHIEs,
} from "../../external/hie/register-facility";

const router = Router();

/** ---------------------------------------------------------------------------
 *
 * PUT /internal/facility/obo
 *
 * Creates a new obo facility and registers it with HIEs.
 *
 * TODO: Add unit tests.
 * TODO: Search existing facility by NPI, cqOboOid, and cwOboOid (individually), and fail if it exists?
 *
 * @return The updated facility.
 */
router.put(
  "/obo",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityInput = facilityOboDetailsSchema.parse(req.body);

    const facility = await registerOBOFacilityWithHIEs(cxId, facilityInput);

    return res.status(httpStatus.OK).json(facility.dataValues);
  })
);

/** ---------------------------------------------------------------------------
 *
 * PUT /internal/facility/non-obo
 *
 * Creates a new non-obo facility and registers it with HIEs.
 *
 * TODO: Add unit tests.
 * TODO: Search existing facility by NPI, cqOboOid, and cwOboOid (individually), and fail if it exists?
 *
 * @return The updated facility.
 */
router.put(
  "/non-obo",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityInput = facilityDetailsSchemaBase.parse(req.body);

    const facility = await registerNonOBOFacilityWithHIEs(cxId, facilityInput);

    return res.status(httpStatus.OK).json(facility.dataValues);
  })
);

export default router;

import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { requestLogger } from "../helpers/request-logger";
import { facilityOboDetailsSchema } from "./schemas/internal-facility";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler } from "../util";
import { registerFacilityWithinHIEs } from "../../external/hie/register-facility.ts";
import { FacilityRegister } from "../../domain/medical/facility";

const router = Router();

/** ---------------------------------------------------------------------------
 *
 * PUT /internal/facility
 *
 * Creates a new facility and registers it within HIEs.
 *
 * TODO: Add unit tests.
 * TODO: Search existing facility by NPI, cqOboOid, and cwOboOid (individually), and fail if it exists?
 *
 * @return The updated facility.
 */
router.put(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityInput = facilityOboDetailsSchema.parse(req.body);

    const facilityUpdate: FacilityRegister = {
      id: facilityInput.id,
      cxId,
      cqOboActive: facilityInput.cqOboActive,
      cwOboActive: facilityInput.cwOboActive,
      cqOboOid: facilityInput.cqOboOid,
      cwOboOid: facilityInput.cwOboOid,
      cwFacilityName: facilityInput.cwFacilityName,
      type: facilityInput.type,
      data: {
        name: facilityInput.nameInMetriport,
        npi: facilityInput.npi,
        address: {
          addressLine1: facilityInput.addressLine1,
          city: facilityInput.city,
          state: facilityInput.state,
          zip: facilityInput.zip,
          country: facilityInput.country,
        },
      },
    };

    const facility = await registerFacilityWithinHIEs(cxId, facilityUpdate);

    return res.status(httpStatus.OK).json(facility);
  })
);

export default router;

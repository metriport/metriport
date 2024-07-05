import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { requestLogger } from "../helpers/request-logger";
import { facilityOboDetailsSchema } from "./schemas/facility";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler } from "../util";
import { registerFacilityWithinHIEs } from "../../external/hie/register-facility";
import { FacilityRegister } from "../../domain/medical/facility";

const router = Router();

/** ---------------------------------------------------------------------------
 *
 * PUT /internal/facility
 *
 * Creates a new facility and registers it within HIEs.
 *
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
      cqActive: facilityInput.cqActive,
      cqType: facilityInput.cqType,
      cqOboOid: facilityInput.cqOboOid,
      cwActive: facilityInput.cwActive,
      cwType: facilityInput.cwType,
      cwOboOid: facilityInput.cwOboOid,
      cwFacilityName: facilityInput.cwFacilityName,
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

    const f = await registerFacilityWithinHIEs(cxId, facilityUpdate);

    return res.status(httpStatus.OK).json({
      id: f.id,
      etag: f.eTag,
      name: f.data.name,
      npi: f.data.npi,
      tin: f.data.tin,
      active: f.data.active,
      address: f.data.address,
      cqType: f.cqType,
      cqActive: f.cqActive,
      cqOboOid: f.cqOboOid,
      cwType: f.cwType,
      cwActive: f.cwActive,
      cwOboOid: f.cwOboOid,
    });
  })
);

export default router;

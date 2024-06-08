import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { z } from "zod";
import { FacilityRegister } from "../../domain/medical/facility";
import { registerFacilityWithinHIEs } from "../../external/hie/facility/register-facility";
import { syncFacilityWithinHIEs } from "../../external/hie/facility/sync-facility";
import { requestLogger } from "../helpers/request-logger";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler } from "../util";
import { facilityOboDetailsSchema } from "./schemas/facility";

const router = Router();

const facilityIdsSchema = z.object({
  facilityIds: z.string().array(),
});

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

    const facility = await registerFacilityWithinHIEs(cxId, facilityUpdate);

    return res.status(httpStatus.OK).json(facility);
  })
);

/** ---------------------------------------------------------------------------
 *
 * POST /internal/facility/sync-with-hies
 *
 * Uses the existing data on the DB to create or update the facilities at the HIEs.
 *
 * @return The updated facility.
 */
router.post(
  "/sync-with-hies",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const { facilityIds } = facilityIdsSchema.parse(req.body);

    await executeAsynchronously(
      facilityIds,
      async facilityId => {
        syncFacilityWithinHIEs(cxId, facilityId);
      },
      { numberOfParallelExecutions: 5 }
    );
    return res.status(httpStatus.OK).json({ message: "Facilities synchronized with HIEs" });
  })
);

export default router;

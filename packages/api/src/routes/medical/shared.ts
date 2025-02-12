import { Request } from "express";
import {
  getFacilityOrFail,
  getSingleFacilityOrFail,
} from "../../command/medical/facility/get-facility";
import { Facility } from "../../domain/medical/facility";
import { getCxIdOrFail, getFromQuery } from "../util";

/**
 * Returns the facility from the request, if provided, or the single facility for the customer.
 *
 * @param req - The request object.
 * @returns the Facility
 * @throws BadRequestError if no ID is provided and more than one facility is found for the customer.
 */
export async function getFacilityFromOptionalParam(req: Request): Promise<Facility> {
  const cxId = getCxIdOrFail(req);
  const facilityIdParam = getFromQuery("facilityId", req);

  if (facilityIdParam) {
    return await getFacilityOrFail({ cxId, id: facilityIdParam });
  }

  return await getSingleFacilityOrFail(cxId);
}

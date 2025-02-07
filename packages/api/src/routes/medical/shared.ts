import { Request } from "express";
import { getOptionalFacilityOrFail } from "../../command/medical/facility/get-facility";
import { Facility } from "../../domain/medical/facility";
import { getCxIdOrFail, getFromQuery } from "../util";

/**
 * Returns the facility from the request, if provided, or the single facility for the customer.
 *
 * @param req - The request object.
 * @returns the Facility
 */
export async function getFacilityFromOptionalParam(req: Request): Promise<Facility> {
  const cxId = getCxIdOrFail(req);
  const facilityIdParam = getFromQuery("facilityId", req);
  return getOptionalFacilityOrFail(cxId, facilityIdParam);
}

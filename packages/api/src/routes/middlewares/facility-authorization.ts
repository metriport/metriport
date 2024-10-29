import { NextFunction, Request, Response } from "express";
import { getFacilityOrFail } from "../../command/medical/facility/get-facility";
import { Facility } from "../../domain/medical/facility";
import { getCxIdOrFail, getFromParamsOrFail, getFromQueryOrFail } from "../util";

/**
 * Validates the customer has access to the facility and adds the facility and related info to the
 * request.
 */
export function facilityAuthorization(
  context: "query" | "params" = "params"
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, _: Response, next: NextFunction): Promise<void> => {
    const cxId = getCxIdOrFail(req);
    const facilityId =
      context === "query" ? getFromQueryOrFail("facilityId", req) : getFromParamsOrFail("id", req);

    const facility = await getFacilityOrFail({ id: facilityId, cxId });

    req.facility = facility;
    req.cxId = cxId;
    req.id = facilityId;

    next();
  };
}

/**
 * Returns the facility, cxId, and id from the request, throwing an error if any are missing.
 */
export function getFacilityInfoOrFail(req: Request): {
  facility: Facility;
  cxId: string;
  id: string;
} {
  const { facility, cxId, id } = { facility: req.facility, cxId: req.cxId, id: req.id };
  if (!facility || !cxId || !id) {
    throw new Error("Missing facility information in request");
  }
  return { facility, cxId, id };
}

import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { createOrUpdateCQOrganization } from "../../external/carequality/command/cq-directory/create-or-update-cq-organization";
import { cqOboFullOrgDetailsSchema } from "../../external/carequality/shared";
import { requestLogger } from "../helpers/request-logger";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler, getFromParamsOrFail } from "../util";

const router = Router();

/** ---------------------------------------------------------------------------
 *
 * POST /internal/facility/
 *
 * TODO: Add description.
 *
 * @return {FacilityDTO} The updated facility.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getFromParamsOrFail("id", req);

    // TODO: Fix the logic to create the facility in the DB
    // const facilityData = facilityCreateSchema.parse(req.body); // TODO: Combine the two schemas into one.

    // const facility = await createFacility({
    //   cxId,
    //   data: {
    //     ...facilityData,
    //     tin: facilityData.tin ?? undefined,
    //     active: facilityData.active ?? undefined,
    //   },
    // });

    const cxOrg = await getOrganizationOrFail({ cxId });

    const body = req.body;
    const orgDetails = cqOboFullOrgDetailsSchema.parse(body);
    const vendorName = orgDetails.healthcareItVendorOrgName ?? cxOrg.dataValues.data?.name;

    // if (!orgDetails.cqOboOid && !orgDetails.oid) throw new Error("Missing OID");

    if (orgDetails.cqActive && orgDetails.cqOboOid) {
      const orgName = buildOrgName(vendorName, orgDetails.name, orgDetails.cqOboOid);
      orgDetails.oid = orgDetails.cqOboOid;
      orgDetails.name = orgName;
      orgDetails.hostOrgOID = cxOrg.dataValues.oid;
      await createOrUpdateCQOrganization(orgDetails);
    }

    return res.sendStatus(httpStatus.OK);
  })
);

function buildOrgName(vendorName: string, orgName: string, oid: string) {
  return `${vendorName} - ${orgName} #OBO# ${oid}`;
}

export default router;

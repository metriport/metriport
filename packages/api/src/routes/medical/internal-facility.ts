import BadRequestError from "@metriport/core/util/error/bad-request";
import NotFoundError from "@metriport/core/util/error/not-found";
import { metriportCompanyDetails } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { z } from "zod";
import { createFacility } from "../../command/medical/facility/create-facility";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import {
  createOrUpdateCQOrganization,
  getCqOrganization,
} from "../../external/carequality/command/cq-directory/create-or-update-cq-organization";
import { metriportEmail as metriportEmailForCq } from "../../external/carequality/constants";
import { requestLogger } from "../helpers/request-logger";
import { required } from "../schemas/shared";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler } from "../util";
import { AddressStrictSchema } from "./schemas/address";

const router = Router();

export const cqOboOrgDetailsSchema = z.object({});
export type CqOboOrgDetails = z.infer<typeof cqOboOrgDetailsSchema>;

const facilityOboDetailsSchemaBase = z
  .object({
    name: z.string(),
    npi: z.string(),
    lat: z.string(),
    lon: z.string(),
    // CQ
    cqActive: z.boolean().optional(),
    cqOboOid: z.string().optional(),
    // TODO 1706: implement this
    // CW
    // cwActive: z.boolean().optional(),
    // cwOboOid: z.string().optional(),
  })
  .merge(AddressStrictSchema);
type FacilityOboDetails = z.infer<typeof facilityOboDetailsSchemaBase>;

const facilityOboDetailsSchema = facilityOboDetailsSchemaBase.refine(
  required<FacilityOboDetails>("cqOboOid").when("cqActive"),
  {
    message: "cqObOid is required and can't be empty when cqActive is true",
    path: ["cqObOid"],
  }
);

/** ---------------------------------------------------------------------------
 *
 * PUT /internal/facility/
 *
 * Creates a new facility and registers it with HIEs the facility is enabled at.
 *
 * WIP: This endpoint is a work in progress and is not yet fully implemented.
 *
 * @return {FacilityDTO} The updated facility.
 */
router.put(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityInput = facilityOboDetailsSchema.parse(req.body);
    // TODO 1706 search existing facility by NPI, cqOboOid, and cwOboOid (individually), and update if exists

    const facility = await createFacility({
      cxId,
      data: {
        name: facilityInput.name,
        npi: facilityInput.npi,
        address: {
          addressLine1: facilityInput.addressLine1,
          addressLine2: facilityInput.addressLine2,
          city: facilityInput.city,
          state: facilityInput.state,
          zip: facilityInput.zip,
          country: facilityInput.country,
        },
      },
      cqOboActive: facilityInput.cqActive,
      cqOboOid: facilityInput.cqOboOid,
      // cwOboActive: facilityInput.cwActive,
      // cwOboOid: facilityInput.cwOboOid,
    });

    const cxOrg = await getOrganizationOrFail({ cxId });

    // TODO 1706: prob want to move these to a separate commands/functions

    // CAREQUALITY
    if (facilityInput.cqActive && facilityInput.cqOboOid) {
      const cqFacilityName = await getCqFacilityName(facilityInput.cqOboOid);
      const vendorName = cxOrg.dataValues.data?.name;
      const orgName = buildCqOboOrgName(vendorName, cqFacilityName, facilityInput.cqOboOid);
      const addressLine = facilityInput.addressLine2
        ? `${facilityInput.addressLine1}, ${facilityInput.addressLine2}`
        : facilityInput.addressLine1;

      console.log("Creating a CQ entry with this OID:", facility.oid);
      await createOrUpdateCQOrganization({
        name: orgName,
        addressLine1: addressLine,
        lat: facilityInput.lat,
        lon: facilityInput.lon,
        city: facilityInput.city,
        state: facilityInput.state,
        postalCode: facilityInput.zip,
        oid: facility.oid,
        contactName: metriportCompanyDetails.name,
        phone: metriportCompanyDetails.phone,
        email: metriportEmailForCq,
        parentOrgOid: cxOrg.oid,
        role: "Connection" as const,
      });
    }

    // COMMONWELL
    // TODO 1706: implement it

    return res.sendStatus(httpStatus.OK);
  })
);

async function getCqFacilityName(oid: string) {
  const existingFacility = await getCqOrganization(oid);
  if (!existingFacility) {
    throw new BadRequestError("CQ OBO organization with the specified CQ OBO OID was not found");
  }
  const existingFacilityName = existingFacility.name?.value;
  if (!existingFacilityName) throw new NotFoundError("CQ OBO organization has no name");
  return existingFacilityName;
}

function buildCqOboOrgName(vendorName: string, orgName: string, oboOid: string) {
  return `${vendorName} - ${orgName} #OBO# ${oboOid}`;
}

export default router;

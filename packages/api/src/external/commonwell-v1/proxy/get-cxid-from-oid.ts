import { NotFoundError } from "@metriport/shared";
import { OrganizationModel } from "../../../models/medical/organization";
import { FacilityModel } from "../../../models/medical/facility";

/**
 * This function is used to get a cxId from a given OID.
 * It will first try to find an organization with the given OID.
 * If it doesn't find one, it will try to find a facility with the given OID.
 * If it doesn't find a facility, it will throw an error.
 * If it finds a facility, it will return the cxId from the facility.
 */
export async function getCxIdFromOidOrFail(oid: string): Promise<{ cxId: string }> {
  // Don't reuse getOrganization or getFacility bc we don't have `cxId` here and we
  // want to keep regular commands requiring `cxId` to avoid cross-tenant data access.
  const query = { where: { oid } };
  const [org, facility] = await Promise.all([
    OrganizationModel.findOne(query),
    FacilityModel.findOne(query),
  ]);
  if (org) return { cxId: org.cxId };
  if (facility) return { cxId: facility.cxId };
  throw new NotFoundError(`Could not find organization with OID ${oid}`);
}

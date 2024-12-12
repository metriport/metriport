import { Organization } from "@metriport/core/domain/organization";
import { metriportCompanyDetails } from "@metriport/shared";
import { Facility, isOboFacility } from "../../../domain/medical/facility";
import { metriportEmail as metriportEmailForCq } from "../constants";
import { CQDirectoryEntryData } from "../cq-directory";
import { buildCqOrgNameForFacility } from "../shared";
import { metriportIntermediaryOid, metriportOid } from "./cq-organization/constants";
import { createOrUpdateCqOrganization } from "./cq-organization/create-or-update-cq-organization";

export type CreateOrUpdateFacilityCmd = {
  facility: Facility;
  org: Organization;
};

/**
 * Creates or updates a Metriport facility in Carequality.
 */
export async function createOrUpdateFacility(
  cmd: CreateOrUpdateFacilityCmd
): Promise<CQDirectoryEntryData> {
  const { facility, org } = cmd;
  const isObo = isOboFacility(facility.cqType);
  const oboOid = isObo ? facility.cqOboOid ?? undefined : undefined;
  if (isObo && !oboOid) {
    throw new Error("OBO OID is required for OBO facilities");
  }
  const cqOrgName = buildCqOrgNameForFacility({
    vendorName: org.data.name,
    orgName: facility.data.name,
    oboOid,
  });
  const parentOrgOid = isObo ? metriportIntermediaryOid : metriportOid;
  return await createOrUpdateCqOrganization({
    cxId: org.cxId,
    name: cqOrgName,
    oid: facility.oid,
    address: facility.data.address,
    contactName: metriportCompanyDetails.name,
    phone: metriportCompanyDetails.phone,
    email: metriportEmailForCq,
    active: org.cqActive,
    role: "Connection" as const,
    parentOrgOid,
    oboOid,
  });
}

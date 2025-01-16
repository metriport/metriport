import { Organization } from "@metriport/core/domain/organization";
import { metriportCompanyDetails } from "@metriport/shared";
import { Facility, isOboFacility } from "../../../domain/medical/facility";
import { metriportEmail as metriportEmailForCq } from "../constants";
import { CQDirectoryEntryData } from "../cq-directory";
import { buildCqOrgNameForFacility, buildCqOrgNameForOboFacility } from "../shared";
import { metriportIntermediaryOid, metriportOid } from "./cq-organization/constants";
import {
  createOrUpdateCqOrganization,
  CreateOrUpdateCqOrganizationCmd,
} from "./cq-organization/create-or-update-cq-organization";

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
  const cqCmd = getCqCommand(cmd);
  return await createOrUpdateCqOrganization(cqCmd);
}

export function getCqCommand(cmd: CreateOrUpdateFacilityCmd): CreateOrUpdateCqOrganizationCmd {
  const { facility, org } = cmd;
  const isObo = isOboFacility(facility.cqType);
  const oboOid = isObo ? facility.cqOboOid ?? undefined : undefined;
  if (isObo && !oboOid) {
    throw new Error("OBO OID is required for OBO facilities");
  }
  const cqOrgName = buildCqOrgNameForFacility({
    vendorName: org.data.name,
    orgName: facility.data.name,
  });
  const oboName = isObo
    ? buildCqOrgNameForOboFacility({
        vendorName: org.data.name,
        orgName: facility.data.name,
        oboOid: oboOid!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
      })
    : undefined;
  const parentOrgOid = isObo ? metriportIntermediaryOid : metriportOid;
  return {
    cxId: org.cxId,
    name: cqOrgName,
    oid: facility.oid,
    address: facility.data.address,
    contactName: metriportCompanyDetails.name,
    phone: metriportCompanyDetails.phone,
    email: metriportEmailForCq,
    active: facility.cqActive,
    role: "Connection" as const,
    parentOrgOid,
    oboOid,
    oboName,
  };
}

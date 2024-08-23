import { OrgType } from "@metriport/core/domain/organization";
import { Facility, isOboFacility } from "../../../domain/medical/facility";
import { createOrUpdateCWOrganization } from "./create-or-update-cw-organization";
import { buildCwOrgNameForFacility } from "../shared";

export async function createOrUpdateFacilityInCw({
  cxId,
  facility,
  cxOrgName,
  cxOrgType,
  cwOboOid,
}: {
  cxId: string;
  facility: Facility;
  cxOrgName: string;
  cxOrgType: OrgType;
  cwOboOid: string | undefined;
}): Promise<void> {
  const orgName = buildCwOrgNameForFacility({
    vendorName: cxOrgName,
    orgName: facility.data.name,
    oboOid: isOboFacility(facility.cwType) ? cwOboOid : undefined,
  });

  await createOrUpdateCWOrganization({
    cxId,
    org: {
      oid: facility.oid,
      data: {
        name: orgName,
        type: cxOrgType,
        location: facility.data.address,
      },
      active: facility.cwActive,
    },
    isObo: isOboFacility(facility.cwType),
  });
}

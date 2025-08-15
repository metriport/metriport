import { TreatmentType } from "@metriport/shared";
import { Facility, isOboFacility } from "../../../domain/medical/facility";
import { buildCwOrgNameForFacility } from "../shared";
import { createOrUpdateCWOrganization } from "./create-or-update-cw-organization";

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
  cxOrgType: TreatmentType;
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

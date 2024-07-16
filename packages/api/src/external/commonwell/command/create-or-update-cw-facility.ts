import { OrgType } from "@metriport/core/domain/organization";
import { Facility } from "../../../domain/medical/facility";
import { createOrUpdateCWOrganization } from "./create-or-update-cw-organization";
import { buildCwOrgNameForFacility } from "../shared";

export async function createOrUpdateInCw({
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
    oboOid: cwOboOid,
  });

  await createOrUpdateCWOrganization(
    cxId,
    {
      oid: facility.oid,
      data: {
        name: orgName,
        type: cxOrgType,
        location: facility.data.address,
      },
      active: facility.cwActive,
    },
    !!cwOboOid
  );
}

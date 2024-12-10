import { processAsyncError } from "@metriport/core/util/error/shared";
import { isOboFacility } from "../../../../domain/medical/facility";
import { FacilityModel } from "../../../../models/medical/facility";
import { OrganizationModel } from "../../../../models/medical/organization";
import { getOrgOrFail } from "./get-cw-organization";
import { createOrUpdateCWOrganization } from "./create-or-update-cw-organization";

export async function updateCWOrganizationAndMetriportEntity({
  cxId,
  oid,
  active,
  org,
  facility,
}: {
  cxId: string;
  oid: string;
  active: boolean;
  org: OrganizationModel;
  facility?: FacilityModel;
}): Promise<void> {
  const cwOrg = await getOrgOrFail(oid);
  if (!cwOrg.name) throw new Error("CW Organization not found");
  if (facility) {
    await facility.update({
      cwActive: active,
    });
  } else {
    await org.update({
      cwActive: active,
    });
  }
  createOrUpdateCWOrganization({
    cxId,
    orgDetails: {
      oid,
      name: cwOrg.name,
      data: {
        name: cwOrg.name,
        type: org.data.type,
        location: facility ? facility.data.address : org.data.location,
      },
      active,
      isObo: facility ? isOboFacility(facility.cwType) : false,
    },
  }).catch(processAsyncError("cw.getAndUpdateCWOrgAndMetriportOrg"));
}

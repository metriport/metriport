import { OrganizationModel } from "../../../models/medical/organization";
import { FacilityModel } from "../../../models/medical/facility";
import { isOboFacility } from "../../../domain/medical/facility";
import { CWOrganization, get, update, create, getParsedOrgOrFail } from "../organization";

export async function createOrUpdateCWOrganization({
  cxId,
  org,
  isObo,
}: {
  cxId: string;
  org: CWOrganization;
  isObo: boolean;
}): Promise<void> {
  const orgExists = await doesOrganizationExistInCW(org.oid);
  if (orgExists) {
    return await update(cxId, org, isObo);
  }
  return await create(cxId, org, isObo);
}

async function doesOrganizationExistInCW(oid: string): Promise<boolean> {
  const org = await get(oid);
  return !!org;
}

export async function getAndUpdateCWOrgAndMetriportOrg({
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
  const cwOrg = await getParsedOrgOrFail(oid);
  await createOrUpdateCWOrganization({
    cxId,
    org: {
      oid,
      data: {
        name: cwOrg.data.name,
        type: org.data.type,
        location: facility ? facility.data.address : org.data.location,
      },
      active,
    },
    isObo: facility ? isOboFacility(facility.cwType) : false,
  });
  if (facility) {
    await facility.update({
      cwActive: active,
    });
  } else {
    await org.update({
      cwActive: active,
    });
  }
}

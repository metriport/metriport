import { isInitiatorAndResponder } from "../../../../domain/medical/facility";
import { FacilityModel } from "../../../../models/medical/facility";
import { OrganizationModel } from "../../../../models/medical/organization";
import { create, CwOrgOrFacility, get, getParsedOrgOrFailV2, update } from "./organization";

export async function createOrUpdateCWOrganizationV2({
  cxId,
  org,
}: {
  cxId: string;
  org: CwOrgOrFacility;
}): Promise<void> {
  const orgExists = await doesOrganizationExistInCW(org.oid);
  if (orgExists) {
    return await update(cxId, org);
  }
  return await create(cxId, org);
}

async function doesOrganizationExistInCW(oid: string): Promise<boolean> {
  const org = await get(oid);
  return !!org;
}

export async function getAndUpdateCWOrgAndMetriportOrgV2({
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
  const cwOrg = await getParsedOrgOrFailV2(oid);
  const initiatorAndResponder = facility ? isInitiatorAndResponder(facility) : true;
  await createOrUpdateCWOrganizationV2({
    cxId,
    org: {
      oid,
      data: {
        name: cwOrg.data.name,
        type: org.data.type,
        location: facility ? facility.data.address : org.data.location,
      },
      active,
      isInitiatorAndResponder: initiatorAndResponder,
    },
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

import { TreatmentType } from "@metriport/shared";
import {
  Facility,
  isInitiatorAndResponder,
  isOboFacility,
} from "../../../../domain/medical/facility";
import { createOrUpdateCWOrganizationV2 } from "../organization/create-or-update-cw-organization";

export async function createOrUpdateFacilityInCwV2({
  cxId,
  facility,
  cxOrgName,
  cxOrgType,
}: {
  cxId: string;
  facility: Facility;
  cxOrgName: string;
  cxOrgType: TreatmentType;
}): Promise<void> {
  const orgName = buildCwOrgNameForFacility({
    vendorName: cxOrgName,
    orgName: facility.data.name,
    oboOid: isOboFacility(facility.cwType) ? facility.cwOboOid ?? undefined : undefined,
  });

  await createOrUpdateCWOrganizationV2({
    cxId,
    org: {
      oid: facility.oid,
      data: {
        name: orgName,
        type: cxOrgType,
        location: facility.data.address,
      },
      active: facility.cwActive,
      isInitiatorAndResponder: isInitiatorAndResponder(facility),
    },
  });
}

function buildCwOrgNameForFacility({
  vendorName,
  orgName,
  oboOid,
}: {
  vendorName: string;
  orgName: string;
  oboOid: string | undefined;
}): string {
  if (oboOid) {
    return `${vendorName} - ${orgName} -OBO- ${oboOid}`;
  }
  return `${vendorName} - ${orgName}`;
}

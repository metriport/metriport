import { TreatmentType } from "@metriport/shared";
import {
  Facility,
  isDelegateFacility,
  isInitiatorAndResponder,
} from "../../../../domain/medical/facility";
import { buildCwOrgNameForFacility } from "../../../commonwell/shared";
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
    principalOid: isDelegateFacility(facility) ? facility.principalOid ?? undefined : undefined,
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

import { OrganizationBizType } from "@metriport/core/domain/organization";
import { metriportCompanyDetails } from "@metriport/shared";
import { Facility, isOboFacility } from "../../../../domain/medical/facility";
import { Config } from "../../../../shared/config";
import { metriportEmail as metriportEmailForCq } from "../../constants";
import { buildCqOrgNameForFacility, getCqAddress } from "../../shared";
import { createOrUpdateCQOrganization } from "./create-or-update-cq-organization";

export const metriportOid = Config.getSystemRootOID();
export const metriportIntermediaryOid = `${metriportOid}.666`;

export async function createOrUpdateFacilityInCq({
  cxId,
  facility,
  cxOrgName,
  cxOrgBizType,
  cqOboOid,
}: {
  cxId: string;
  facility: Facility;
  cxOrgName: string;
  cxOrgBizType: OrganizationBizType;
  cqOboOid: string | undefined;
}): Promise<void> {
  const orgName = buildCqOrgNameForFacility({
    vendorName: cxOrgName,
    orgName: facility.data.name,
    oboOid: isOboFacility(facility.cqType) ? cqOboOid : undefined,
  });

  const { coordinates, addressLine } = await getCqAddress({ cxId, address: facility.data.address });
  await createOrUpdateCQOrganization({
    name: orgName,
    addressLine1: addressLine,
    lat: coordinates.lat.toString(),
    lon: coordinates.lon.toString(),
    city: facility.data.address.city,
    state: facility.data.address.state,
    postalCode: facility.data.address.zip,
    oid: facility.oid,
    contactName: metriportCompanyDetails.name,
    phone: metriportCompanyDetails.phone,
    email: metriportEmailForCq,
    organizationBizType: cxOrgBizType,
    active: facility.cqActive,
    parentOrgOid: isOboFacility(facility.cqType) ? metriportIntermediaryOid : metriportOid,
    role: "Connection" as const,
  });
}

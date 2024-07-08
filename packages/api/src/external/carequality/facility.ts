import { OrganizationBizType } from "@metriport/core/domain/organization";
import { metriportEmail as metriportEmailForCq } from "./constants";
import { metriportCompanyDetails } from "@metriport/shared";
import { Facility } from "../../domain/medical/facility";
import { createOrUpdateCQOrganization } from "./command/cq-directory/create-or-update-cq-organization";
import { buildCqOrgNameForFacility } from "./shared";
import { Config } from "../../shared/config";
import { getAddressWithCoordinates } from "../../domain/medical/address";

const metriportOid = Config.getSystemRootOID();
const metriportIntermediaryOid = `${metriportOid}.666`;

export async function createOrUpdateFacilityInCq({
  cxId,
  facility,
  facilityName,
  cxOrgName,
  cxOrgBizType,
  cqOboOid,
}: {
  cxId: string;
  facility: Facility;
  facilityName: string | undefined;
  cxOrgName: string;
  cxOrgBizType: OrganizationBizType;
  cqOboOid: string | undefined;
}): Promise<void> {
  const orgName = buildCqOrgNameForFacility({
    vendorName: cxOrgName,
    orgName: facilityName ?? facility.data.name,
    oboOid: cqOboOid,
  });

  const { coordinates } = await getAddressWithCoordinates(facility.data.address, cxId);
  const address = facility.data.address;
  const addressLine = address.addressLine2
    ? `${address.addressLine1}, ${address.addressLine2}`
    : address.addressLine1;

  await createOrUpdateCQOrganization({
    name: orgName,
    addressLine1: addressLine,
    lat: coordinates.lat.toString(),
    lon: coordinates.lon.toString(),
    city: address.city,
    state: address.state,
    postalCode: address.zip,
    oid: facility.oid,
    contactName: metriportCompanyDetails.name,
    phone: metriportCompanyDetails.phone,
    email: metriportEmailForCq,
    organizationBizType: cxOrgBizType,
    active: facility.cqActive,
    parentOrgOid: cqOboOid ? metriportIntermediaryOid : metriportOid,
    role: "Connection" as const,
  });
}

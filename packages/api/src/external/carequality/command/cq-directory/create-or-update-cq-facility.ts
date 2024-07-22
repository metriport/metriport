import { OrganizationBizType } from "@metriport/core/domain/organization";
import { metriportEmail as metriportEmailForCq } from "../../constants";
import { metriportCompanyDetails } from "@metriport/shared";
import { Facility } from "../../../../domain/medical/facility";
import { createOrUpdateCQOrganization } from "./create-or-update-cq-organization";
import { buildCqOrgNameForFacility, getCqAddress } from "../../shared";
import { Config } from "../../../../shared/config";

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
    oboOid: cqOboOid,
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
    parentOrgOid: cqOboOid ? metriportIntermediaryOid : metriportOid,
    role: "Connection" as const,
  });
}

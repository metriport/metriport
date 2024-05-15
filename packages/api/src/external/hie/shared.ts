import { AddressWithCoordinates } from "@metriport/core/domain/location-address";
import { out } from "@metriport/core/util/log";
import { OrgType } from "@metriport/core/domain/organization";
import { metriportEmail as metriportEmailForCq } from "../../external/carequality/constants";
import { metriportCompanyDetails } from "@metriport/shared";
import { Facility } from "../../domain/medical/facility";
import { createOrUpdateCQOrganization } from "../../external/carequality/command/cq-directory/create-or-update-cq-organization";
import { createOrUpdateCWOrganization } from "../../external/commonwell/create-or-update-cw-organization";

export async function createOrUpdateInCq(
  facility: Facility,
  cxOid: string,
  orgName: string,
  coordinates: AddressWithCoordinates
): Promise<void> {
  const { log } = out("createOrUpdateInCq");
  const { address } = facility.data;

  const addressLine = address.addressLine2
    ? `${address.addressLine1}, ${address.addressLine2}`
    : address.addressLine1;

  log(`Creating/Updating a CQ entry with this OID ${facility.oid} and name ${orgName}`);

  await createOrUpdateCQOrganization({
    name: orgName,
    addressLine1: addressLine,
    lat: coordinates.lat,
    lon: coordinates.lon,
    city: address.city,
    state: address.state,
    postalCode: address.zip,
    oid: facility.oid,
    contactName: metriportCompanyDetails.name,
    phone: metriportCompanyDetails.phone,
    email: metriportEmailForCq,
    parentOrgOid: cxOid,
    role: "Connection" as const,
  });
}

export async function createOrUpdateInCw(
  facility: Facility,
  orgName: string,
  cxOrgType: OrgType,
  cxId: string,
  isObo: boolean
): Promise<void> {
  const { log } = out("createOrUpdateInCw");
  log(`Creating/Updating a CW entry with this OID ${facility.oid} and name ${orgName}`);

  await createOrUpdateCWOrganization(
    {
      cxId,
      id: facility.id,
      oid: facility.oid,
      data: {
        name: orgName,
        type: cxOrgType,
        location: facility.data.address,
      },
      organizationNumber: facility.facilityNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    isObo
  );
}

import { Coordinates } from "@metriport/core/domain/address";
import { out } from "@metriport/core/util/log";
import { OrgType } from "@metriport/core/domain/organization";
import { metriportEmail as metriportEmailForCq } from "../../external/carequality/constants";
import { metriportCompanyDetails } from "@metriport/shared";
import { Facility } from "../../domain/medical/facility";
import { createOrUpdateCQOrganization } from "../../external/carequality/command/cq-directory/create-or-update-cq-organization";
import { createOrUpdateCWOrganization } from "../../external/commonwell/create-or-update-cw-organization";
import { CqOboDetails } from "../../external/carequality/get-obo-data";
import { buildCqOrgName } from "../../external/carequality/shared";
import { buildCwOrgName } from "../../external/commonwell/shared";
import { isOboFacility, isNonOboFacility } from "../../domain/medical/facility";

export async function createOrUpdateInCq(
  facility: Facility,
  cxOrg: { name: string; oid: string; type: OrgType },
  cqOboData: CqOboDetails,
  coordinates: Coordinates
): Promise<void> {
  const { log } = out("createOrUpdateInCq");
  const isObo = isOboFacility(facility.cqType);
  const isProvider = isNonOboFacility(facility.cqType);
  const cqOboDisabled = !isObo || !cqOboData.enabled;

  if (cqOboDisabled && !isProvider) {
    log(`CQ OBO is not enabled for this facility`);
    return;
  }

  const cqFacilityName = cqOboData.enabled ? cqOboData.cqFacilityName : facility.data.name;
  const cqOboOid = cqOboData.enabled ? cqOboData.cqOboOid : undefined;
  const orgName = buildCqOrgName({
    vendorName: cxOrg.name,
    orgName: cqFacilityName,
    isProvider,
    oboOid: cqOboOid,
  });

  log(`Creating/Updating a CQ entry with this OID ${facility.oid} and name ${orgName}`);

  const { address } = facility.data;
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
    parentOrgOid: cxOrg.oid,
    role: "Connection" as const,
  });
}

export async function createOrUpdateInCw(
  facility: Facility,
  facilityName: string | undefined,
  cxOrg: { name: string; oid: string; type: OrgType },
  cxId: string
): Promise<void> {
  const { log } = out("createOrUpdateInCw");

  const isProvider = isNonOboFacility(facility.cwType);
  const isObo = isOboFacility(facility.cwType);
  const cwOboDisabled = !isObo || !facility.cwOboActive || !facility.cwOboOid;

  if (cwOboDisabled && !isProvider) {
    log(`CW OBO is not enabled for this facility`);
    return;
  }

  const cwFacilityName = facilityName ?? facility.data.name;
  const orgName = buildCwOrgName({
    vendorName: cxOrg.name,
    orgName: cwFacilityName,
    isProvider,
    oboOid: facility.cwOboOid,
  });

  log(`Creating/Updating a CW entry with this OID ${facility.oid} and name ${orgName}`);

  await createOrUpdateCWOrganization(
    {
      cxId,
      id: facility.id,
      oid: facility.oid,
      data: {
        name: orgName,
        type: cxOrg.type,
        location: facility.data.address,
      },
      organizationNumber: facility.facilityNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    isObo
  );
}

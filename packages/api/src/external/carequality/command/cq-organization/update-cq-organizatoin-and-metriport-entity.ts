import { processAsyncError } from "@metriport/core/util/error/shared";
import { metriportCompanyDetails, MetriportError } from "@metriport/shared";
import { isOboFacility } from "../../../../domain/medical/facility";
import { FacilityModel } from "../../../../models/medical/facility";
import { OrganizationModel } from "../../../../models/medical/organization";
import { metriportEmail as metriportEmailForCq } from "../../constants";
import { getCqAddress } from "../../shared";
import {
  createOrUpdateCQOrganization,
  metriportIntermediaryOid,
  metriportOid,
} from "./create-or-update-cq-organization";
import { getCqOrgOrFail } from "./get-cq-organization";

export async function updateCQOrganizationAndMetriportEntity({
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
  const cqOrg = await getCqOrgOrFail(oid);
  if (!cqOrg.name) throw new MetriportError("CQ Organization missing name", undefined, { oid });
  if (facility) {
    await facility.update({
      cqActive: active,
    });
  } else {
    await org.update({
      cqActive: active,
    });
  }
  const address = facility ? facility.data.address : org.data.location;
  const { coordinates, addressLine } = await getCqAddress({ cxId, address });
  createOrUpdateCQOrganization({
    name: cqOrg.name,
    addressLine1: addressLine,
    lat: coordinates.lat.toString(),
    lon: coordinates.lon.toString(),
    city: address.city,
    state: address.state,
    postalCode: address.zip,
    oid,
    contactName: metriportCompanyDetails.name,
    phone: metriportCompanyDetails.phone,
    email: metriportEmailForCq,
    parentOrgOid: facility
      ? isOboFacility(facility.cqType)
        ? metriportIntermediaryOid
        : metriportOid
      : undefined,
    active,
    role: "Connection" as const,
  }).catch(processAsyncError("cq.getAndUpdateCQOrgAndMetriportOrg"));
}

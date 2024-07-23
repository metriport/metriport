import NotFoundError from "@metriport/core/util/error/not-found";
import { CarequalityManagementAPI } from "@metriport/carequality-sdk";
import { isOboFacility } from "../../../../domain/medical/facility";
import { OrganizationModel } from "../../../../models/medical/organization";
import { FacilityModel } from "../../../../models/medical/facility";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { makeCarequalityManagementAPI } from "../../api";
import { CQOrganization } from "../../organization";
import { CQOrgDetails, getCqAddress, getParsedCqOrgOrFail } from "../../shared";
import { metriportIntermediaryOid, metriportOid } from "./create-or-update-cq-facility";
import { metriportEmail as metriportEmailForCq } from "../../constants";
import { metriportCompanyDetails } from "@metriport/shared";

const cq = makeCarequalityManagementAPI();

export async function createOrUpdateCQOrganization(
  orgDetails: CQOrgDetails
): Promise<string | undefined> {
  if (!cq) throw new Error("Carequality API not initialized");
  const org = CQOrganization.fromDetails(orgDetails);
  const orgExists = await doesOrganizationExistInCQ(cq, org.oid);
  if (orgExists) {
    return updateCQOrganization(cq, org);
  }
  return registerOrganization(cq, org);
}

export async function doesOrganizationExistInCQ(
  cq: CarequalityManagementAPI,
  oid: string
): Promise<boolean | undefined> {
  const { log } = out(`CQ doesOrganizationExistInCQ - CQ Org OID ${oid}`);

  try {
    const resp = await cq.listOrganizations({ count: 1, oid });
    return resp.length > 0;
  } catch (error) {
    const msg = `Failure while getting Org @ CQ`;
    log(`${msg}. Org OID: ${oid}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        orgOid: oid,
        context: `cq.org.get`,
        error,
      },
    });
    throw error;
  }
}

export async function updateCQOrganization(
  cq: CarequalityManagementAPI,
  cqOrg: CQOrganization
): Promise<string | undefined> {
  const { log } = out(`CQ updateCQOrganization - CQ Org OID ${cqOrg.oid}`);

  try {
    return await cq.updateOrganization(cqOrg.getXmlString(), cqOrg.oid);
  } catch (error) {
    const msg = `Failure while updating org @ CQ`;
    log(`${msg}. Org OID: ${cqOrg.oid}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        orgOid: cqOrg.oid,
        context: `cq.org.update`,
        error,
      },
    });
    throw error;
  }
}

export async function registerOrganization(
  cq: CarequalityManagementAPI,
  cqOrg: CQOrganization
): Promise<string | undefined> {
  const { log } = out(`CQ registerOrganization - CQ Org OID ${cqOrg.oid}`);

  try {
    return await cq.registerOrganization(cqOrg.getXmlString());
  } catch (error) {
    const msg = `Failure while registering org @ CQ`;
    log(`${msg}. Org OID: ${cqOrg.oid}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        orgOid: cqOrg.oid,
        context: `cq.org.create`,
        error,
      },
    });
    throw error;
  }
}

export async function getAndUpdateCQOrgAndMetriportOrg({
  cq,
  cxId,
  oid,
  active,
  org,
  facility,
}: {
  cq: CarequalityManagementAPI;
  cxId: string;
  oid: string;
  active: boolean;
  org: OrganizationModel;
  facility?: FacilityModel;
}): Promise<void> {
  const cqOrg = await getParsedCqOrgOrFail(cq, oid);
  if (!cqOrg.name) throw new NotFoundError("CQ org name is not set - cannot update");
  const address = facility ? facility.data.address : org.data.location;
  const { coordinates, addressLine } = await getCqAddress({ cxId, address });
  await createOrUpdateCQOrganization({
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
    organizationBizType: org.type,
    parentOrgOid: facility
      ? isOboFacility(facility.cqType)
        ? metriportIntermediaryOid
        : metriportOid
      : undefined,
    active,
    role: "Connection" as const,
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

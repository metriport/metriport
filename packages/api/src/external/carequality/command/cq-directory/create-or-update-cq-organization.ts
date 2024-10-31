import { errorToString, BadRequestError, metriportCompanyDetails } from "@metriport/shared";
import { CarequalityManagementAPI } from "@metriport/carequality-sdk";
import { isOboFacility } from "../../../../domain/medical/facility";
import { OrganizationModel } from "../../../../models/medical/organization";
import { FacilityModel } from "../../../../models/medical/facility";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { makeCarequalityManagementAPI } from "../../api";
import { CQOrganization } from "../../organization";
import { CQOrgDetails, getCqAddress, getParsedCqOrgOrFail, getCqOrg } from "../../shared";
import { metriportIntermediaryOid, metriportOid } from "./create-or-update-cq-facility";
import { metriportEmail as metriportEmailForCq } from "../../constants";

const cq = makeCarequalityManagementAPI();

export async function createOrUpdateCQOrganization(
  orgDetails: CQOrgDetails
): Promise<string | undefined> {
  if (!cq) throw new Error("Carequality API not initialized");
  const org = CQOrganization.fromDetails(orgDetails);
  const orgFromDir = await getCqOrg(cq, org.oid);
  if (orgFromDir) {
    return await updateCQOrganization(cq, org);
  }
  return await registerOrganization(cq, org);
}

export async function updateCQOrganization(
  cq: CarequalityManagementAPI,
  cqOrg: CQOrganization
): Promise<string | undefined> {
  const { log } = out(`CQ updateCQOrganization - CQ Org OID ${cqOrg.oid}`);

  try {
    return await cq.updateOrganization(cqOrg.getXmlString(), cqOrg.oid);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const level = error.code === "ECONNABORTED" ? "info" : "error";
    const msg = `Failure while updating org @ CQ`;
    log(`${msg}. Org OID: ${cqOrg.oid}. Cause: ${errorToString(error)}`);
    capture.message(msg, {
      extra: {
        orgOid: cqOrg.oid,
        context: `cq.org.update`,
        error,
      },
      level,
    });
    if (level === "error") throw error;
    return undefined;
  }
}

export async function registerOrganization(
  cq: CarequalityManagementAPI,
  cqOrg: CQOrganization
): Promise<string | undefined> {
  const { log } = out(`CQ registerOrganization - CQ Org OID ${cqOrg.oid}`);

  try {
    return await cq.registerOrganization(cqOrg.getXmlString());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const level = error.response?.status === 403 ? "info" : "error";
    const msg = `Failure while registering org @ CQ`;
    log(`${msg}. Org OID: ${cqOrg.oid}. Cause: ${errorToString(error)}`);
    capture.message(msg, {
      extra: {
        orgOid: cqOrg.oid,
        context: `cq.org.create`,
        error,
      },
      level,
    });
    if (level === "error") throw error;
    return undefined;
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
  if (!cqOrg.name) throw new BadRequestError("CQ org name is not set - cannot update");
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
}

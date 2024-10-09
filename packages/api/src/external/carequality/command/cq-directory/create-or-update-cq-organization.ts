import { NotFoundError, metriportCompanyDetails } from "@metriport/shared";
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

const cq = makeCarequalityManagementAPI();

export async function createOrUpdateCQOrganization(
  orgDetails: CQOrgDetails,
  active: boolean
): Promise<string> {
  if (!cq) throw new Error("Carequality API not initialized");
  const org = CQOrganization.fromDetails(orgDetails);
  const orgExists = await doesOrganizationExistInCQ(cq, org.oid, active);
  if (orgExists) {
    return await updateCQOrganization(cq, org);
  }
  return await registerOrganization(cq, org);
}

export async function doesOrganizationExistInCQ(
  cq: CarequalityManagementAPI,
  oid: string,
  active: boolean
): Promise<boolean> {
  const { log } = out(`CQ doesOrganizationExistInCQ - CQ Org OID ${oid}`);

  try {
    const resp = await cq.listOrganizations({ count: 1, oid, active });
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
): Promise<string> {
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
): Promise<string> {
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
  const currentActive = facility ? facility.cqActive : org.cqActive;
  const cqOrg = await getParsedCqOrgOrFail(cq, oid, currentActive);
  if (!cqOrg.name) throw new NotFoundError("CQ org name is not set - cannot update");
  const address = facility ? facility.data.address : org.data.location;
  const { coordinates, addressLine } = await getCqAddress({ cxId, address });
  await createOrUpdateCQOrganization(
    {
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
    },
    currentActive
  );
  if (facility) {
    await facility.update({
      cqActive: active,
    });
  } else {
    await org.update({
      cqActive: active,
    });
  }
}

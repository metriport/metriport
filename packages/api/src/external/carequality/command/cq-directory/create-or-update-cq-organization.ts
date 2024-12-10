import { Organization } from "@medplum/fhirtypes";
import { CarequalityManagementAPIFhir } from "@metriport/carequality-sdk";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, metriportCompanyDetails, MetriportError } from "@metriport/shared";
import { isOboFacility } from "../../../../domain/medical/facility";
import { FacilityModel } from "../../../../models/medical/facility";
import { OrganizationModel } from "../../../../models/medical/organization";
import { makeCarequalityManagementAPIFhir } from "../../api";
import { metriportEmail as metriportEmailForCq } from "../../constants";
import { CQOrganization } from "../../organization";
import { CQOrgDetails, getCqAddress, getCqOrg, getCqOrgOrFail } from "../../shared";
import { metriportIntermediaryOid, metriportOid } from "./create-or-update-cq-facility";
import { processAsyncError } from "@metriport/core/util/error/shared";

const cq = makeCarequalityManagementAPIFhir();

export async function createOrUpdateCQOrganization(
  orgDetails: CQOrgDetails
): Promise<Organization | undefined> {
  if (!cq) throw new Error("Carequality API not initialized");
  const cqOrg = CQOrganization.fromDetails(orgDetails);
  const org = await getCqOrg(cq, cqOrg.oid);
  if (org) return await updateCQOrganization(cq, cqOrg);
  return await registerOrganization(cq, cqOrg);
}

export async function updateCQOrganization(
  cq: CarequalityManagementAPIFhir,
  cqOrg: CQOrganization
): Promise<Organization> {
  const { log } = out(`CQ updateCQOrganization - CQ Org OID ${cqOrg.oid}`);

  try {
    return await cq.updateOrganization({
      org: cqOrg.createFhirOrganization(),
      oid: cqOrg.oid,
    });
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
  cq: CarequalityManagementAPIFhir,
  cqOrg: CQOrganization
): Promise<Organization> {
  const { log } = out(`CQ registerOrganization - CQ Org OID ${cqOrg.oid}`);

  try {
    return await cq.registerOrganization(cqOrg.createFhirOrganization());
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
  cq: CarequalityManagementAPIFhir;
  cxId: string;
  oid: string;
  active: boolean;
  org: OrganizationModel;
  facility?: FacilityModel;
}): Promise<void> {
  const cqOrg = await getCqOrgOrFail(cq, oid);
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
    organizationBizType: org.type,
    parentOrgOid: facility
      ? isOboFacility(facility.cqType)
        ? metriportIntermediaryOid
        : metriportOid
      : undefined,
    active,
    role: "Connection" as const,
  }).catch(processAsyncError("cq.getAndUpdateCQOrgAndMetriportOrg"));
}

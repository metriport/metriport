import { OrganizationData } from "@metriport/core/domain/organization";
import { OrganizationModel } from "../../../models/medical/organization";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getOrganizationOrFail } from "./get-organization";
import { toFHIR } from "../../../external/fhir/organization";
import { upsertOrgToFHIRServer } from "../../../external/fhir/organization/upsert-organization";
import { metriportEmail as metriportEmailForCq } from "../../../external/carequality/constants";
import { metriportCompanyDetails } from "@metriport/shared";
import cwCommands from "../../../external/commonwell";
import cqCommands from "../../../external/carequality";
import { getAddressWithCoordinates } from "../../../domain/medical/address";
import { processAsyncError } from "../../../errors";

export type OrganizationUpdateCmd = BaseUpdateCmdWithCustomer & OrganizationData;

export const updateOrganization = async (
  orgUpdate: OrganizationUpdateCmd
): Promise<OrganizationModel> => {
  const { id, cxId, eTag, name, type, location } = orgUpdate;

  const org = await getOrganizationOrFail({ id, cxId });
  validateVersionForUpdate(org, eTag);

  const updatedOrg = await org.update({
    data: {
      name,
      type,
      location,
    },
  });

  const fhirOrg = toFHIR(updatedOrg);
  await upsertOrgToFHIRServer(updatedOrg.cxId, fhirOrg);

  if (org.type === "healthcare_provider") {
    // Intentionally asynchronous
    cwCommands.organization
      .update(cxId, {
        oid: updatedOrg.oid,
        data: updatedOrg.data,
        active: updatedOrg.cwActive,
      })
      .catch(processAsyncError(`cw.org.update`));

    const { coordinates } = await getAddressWithCoordinates(updatedOrg.data.location, cxId);
    const address = updatedOrg.data.location;
    const addressLine = address.addressLine2
      ? `${address.addressLine1}, ${address.addressLine2}`
      : address.addressLine1;

    cqCommands.organization
      .createOrUpdate({
        name: updatedOrg.data.name,
        addressLine1: addressLine,
        lat: coordinates.lat.toString(),
        lon: coordinates.lon.toString(),
        city: address.city,
        state: address.state,
        postalCode: address.zip,
        oid: updatedOrg.oid,
        organizationBizType: updatedOrg.type,
        contactName: metriportCompanyDetails.name,
        phone: metriportCompanyDetails.phone,
        email: metriportEmailForCq,
        active: updatedOrg.cqActive,
        role: "Connection" as const,
      })
      .catch(processAsyncError(`cq.org.update`));
  }

  return updatedOrg;
};

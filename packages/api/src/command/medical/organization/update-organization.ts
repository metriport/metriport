import { OrganizationData } from "@metriport/core/domain/organization";
import { OrganizationModel } from "../../../models/medical/organization";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getOrganizationOrFail } from "./get-organization";
import { toFHIR } from "../../../external/fhir/organization";
import { upsertOrgToFHIRServer } from "../../../external/fhir/organization/upsert-organization";
import { CqMetriportDataDefault } from "../../../external/carequality/shared";
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
        ...updatedOrg,
        active: updatedOrg.cwActive,
      })
      .catch(processAsyncError(`cw.org.create`));

    const locationWithCoordinates = await getAddressWithCoordinates(updatedOrg.data.location, cxId);
    cqCommands.organization
      .createOrUpdate({
        oid: org.oid,
        name: org.data.name,
        ...locationWithCoordinates,
        lat: `${locationWithCoordinates.coordinates.lat}`,
        lon: `${locationWithCoordinates.coordinates.lon}`,
        postalCode: locationWithCoordinates.zip,
        organizationBizType: org.type,
        active: updatedOrg.cqActive,
        ...CqMetriportDataDefault,
      })
      .catch(processAsyncError(`cq.org.update`));
  }

  return updatedOrg;
};

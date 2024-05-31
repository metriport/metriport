import { OrganizationData } from "@metriport/core/domain/organization";
import { OrganizationModel } from "../../../models/medical/organization";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getOrganizationOrFail } from "./get-organization";
import { toFHIR } from "../../../external/fhir/organization";
import { upsertOrgToFHIRServer } from "../../../external/fhir/organization/upsert-organization";
import cwCommands from "../../../external/commonwell";
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

  if (org.type !== "healthcare_it_vendor") {
    // Intentionally asynchronous
    cwCommands.organization.update(updatedOrg).catch(processAsyncError(`cw.org.update`));
  }

  return updatedOrg;
};

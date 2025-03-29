import { OrganizationCreate } from "@metriport/core/domain/organization";
import { validateVersionForUpdate } from "../../../models/_default";
import { OrganizationModel } from "../../../models/medical/organization";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getOrganizationOrFail } from "./get-organization";

export type OrganizationUpdateCmd = BaseUpdateCmdWithCustomer &
  Partial<Omit<OrganizationCreate, "type">>;

export async function updateOrganization({
  id,
  eTag,
  cxId,
  data,
  cqApproved,
  cqActive,
  cwApproved,
  cwActive,
}: OrganizationUpdateCmd): Promise<OrganizationModel> {
  const org = await getOrganizationOrFail({ id, cxId });
  validateVersionForUpdate(org, eTag);
  const updatedOrg = await org.update({
    data,
    cqActive,
    cwActive,
    cqApproved,
    cwApproved,
  });

  return updatedOrg;
}

import { OrganizationCreate, validateOrgDelegation } from "@metriport/core/domain/organization";
import { toFHIR } from "@metriport/core/external/fhir/organization/conversion";
import { upsertOrgToFHIRServer } from "../../../external/fhir/organization/upsert-organization";
import { OrganizationModel } from "../../../models/medical/organization";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getOrganizationOrFail } from "./get-organization";

export type OrganizationUpdateCmd = BaseUpdateCmdWithCustomer & Partial<OrganizationCreate>;

export async function updateOrganization({
  id,
  eTag,
  cxId,
  data,
  cqApproved,
  cqActive,
  cwApproved,
  cwActive,
  ehexApproved,
  ehexActive,
  type,
  principalOid,
  delegateOids,
}: OrganizationUpdateCmd): Promise<OrganizationModel> {
  const org = await getOrganizationOrFail({ id, cxId });
  validateVersionForUpdate(org, eTag);

  const newPrincipalOid = principalOid ?? null;
  const newDelegateOids = delegateOids ?? [];

  validateOrgDelegation({ principalOid: newPrincipalOid, delegateOids: newDelegateOids });

  const updatedOrg = await org.update({
    data,
    cqActive,
    cwActive,
    ehexActive,
    cqApproved,
    cwApproved,
    ehexApproved,
    type,
    principalOid: newPrincipalOid,
    delegateOids: newDelegateOids,
  });

  const fhirOrg = toFHIR(updatedOrg);
  await upsertOrgToFHIRServer(updatedOrg.cxId, fhirOrg);

  return updatedOrg;
}

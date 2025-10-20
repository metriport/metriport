import { Organization } from "@metriport/core/domain/organization";
import { metriportCompanyDetails } from "@metriport/shared";
import { metriportEmail as metriportEmailForCq } from "../constants";
import { CQDirectoryEntryData } from "../cq-directory";
import {
  createOrUpdateCqOrganization,
  CreateOrUpdateCqOrganizationCmd,
} from "./cq-organization/create-or-update-cq-organization";

export type CreateOrUpdateOrganizationCmd = {
  org: Organization;
};

/**
 * Creates or updates a Metriport organization in Carequality.
 */
export async function createOrUpdateOrganization(
  cmd: CreateOrUpdateOrganizationCmd
): Promise<CQDirectoryEntryData> {
  const cqCmd = getCqCommand(cmd);
  return await createOrUpdateCqOrganization(cqCmd);
}

export function getCqCommand(cmd: CreateOrUpdateOrganizationCmd): CreateOrUpdateCqOrganizationCmd {
  const { org } = cmd;
  return {
    cxId: org.cxId,
    oid: org.oid,
    name: org.data.name,
    address: org.data.location,
    contactName: metriportCompanyDetails.name,
    phone: metriportCompanyDetails.phone,
    email: metriportEmailForCq,
    active: org.cqActive,
    role: "Connection" as const,
  };
}

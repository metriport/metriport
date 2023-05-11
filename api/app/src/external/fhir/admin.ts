import { Organization } from "../../models/medical/organization";
import { Config } from "../../shared/config";
import { makeAdminFhirApi } from "./api";

type OrgToCreateTenant = Pick<Organization, "organizationNumber" | "cxId">;

const api = makeAdminFhirApi();

/**
 * Creates the organization on the FHIR server.
 */
export const createTenant = async (organization: OrgToCreateTenant): Promise<void> => {
  if (Config.isSandbox()) return;

  await api.createTenant(organization);
};

/**
 * Check if the organization exists on the FHIR server and create it if it doesn't.
 */
export const createTenantSafe = async (organization: OrgToCreateTenant): Promise<void> => {
  if (Config.isSandbox()) return;

  const tenants = await api.listTenants();
  if (!tenants.includes(organization.cxId)) await api.createTenant(organization);
};

import { Organization } from "../../models/medical/organization";
import { Config } from "../../shared/config";
import { api } from "./api";

type OrgToCreateTenant = Pick<Organization, "organizationNumber" | "cxId">;

/**
 * Creates the organization on the FHIR server.
 */
export const createTenant = async (organization: OrgToCreateTenant) => {
  if (Config.isSandbox()) return;

  await api.createTenant(organization);
};

/**
 * Check if the organization exists on the FHIR server and create it if it doesn't.
 */
export const createTenantSafe = async (organization: OrgToCreateTenant) => {
  if (Config.isSandbox()) return;

  const tenants = await api.listTenants();
  if (!tenants.includes(organization.cxId)) await api.createTenant(organization);
};

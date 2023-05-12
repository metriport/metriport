import { Organization } from "../../models/medical/organization";
import { Config } from "../../shared/config";
import { makeFhirAdminApi } from "./api/api-factory";

type OrgToCreateTenant = Pick<Organization, "organizationNumber" | "cxId">;

const api = makeFhirAdminApi();

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
export const createTenantIfNotExists = async (organization: OrgToCreateTenant): Promise<void> => {
  if (Config.isSandbox()) return;
  if (!(await tenantExists(organization.cxId))) await api.createTenant(organization);
};

/**
 * Checks whether a tenant exists on the FHIR server.
 */
export async function tenantExists(tenantId: string): Promise<boolean> {
  const tenants = await api.listTenants();
  return tenants.includes(tenantId);
}

import { Organization } from "@metriport/core/domain/organization";
import { makeFhirAdminApi } from "./api/api-factory";

type OrgToCreateTenant = Pick<Organization, "organizationNumber" | "cxId">;

const api = makeFhirAdminApi();

/**
 * Creates the organization on the FHIR server.
 */
export const createTenant = async (organization: OrgToCreateTenant): Promise<void> => {
  await api.createTenant(organization);
};

/**
 * Check if the organization exists on the FHIR server and create it if it doesn't.
 */
export const createTenantIfNotExists = async (organization: OrgToCreateTenant): Promise<void> => {
  if (!(await tenantExists(organization.cxId))) await api.createTenant(organization);
};

/**
 * Checks whether a tenant exists on the FHIR server.
 */
export async function tenantExists(tenantId: string): Promise<boolean> {
  const tenants = await api.listTenants();
  return tenants.includes(tenantId);
}

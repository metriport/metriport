import { Organization } from "@metriport/core/domain/organization";
import { FhirAdminClient } from "@metriport/core/external/fhir/api/api";
import { makeFhirAdminApi } from "./api/api-factory";

type OrgToCreateTenant = Pick<Organization, "organizationNumber" | "cxId">;

let api: FhirAdminClient | undefined = undefined;

function getApi(): FhirAdminClient {
  if (!api) api = makeFhirAdminApi();
  return api;
}

/**
 * Creates the organization on the FHIR server.
 */
export const createTenant = async (organization: OrgToCreateTenant): Promise<void> => {
  await getApi().createTenant(organization);
};

/**
 * Check if the organization exists on the FHIR server and create it if it doesn't.
 */
export const createTenantIfNotExists = async (organization: OrgToCreateTenant): Promise<void> => {
  if (!(await tenantExists(organization.cxId))) await getApi().createTenant(organization);
};

/**
 * Checks whether a tenant exists on the FHIR server.
 */
export async function tenantExists(tenantId: string): Promise<boolean> {
  const tenants = await getApi().listTenants();
  return tenants.includes(tenantId);
}

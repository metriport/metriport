import { Organization } from "@medplum/fhirtypes";

export type ListOrganizationsParams = {
  count?: number;
  start?: number;
  oid?: string;
  active?: boolean;
};

export type UpdateOrganizationParams = {
  org: Organization;
  oid: string;
};

export interface CarequalityManagementAPIFhir {
  listOrganizations({
    count,
    start,
    oid,
    active,
  }: ListOrganizationsParams): Promise<Organization[]>;
  registerOrganization(org: Organization): Promise<Organization | undefined>;
  updateOrganization({ org, oid }: UpdateOrganizationParams): Promise<Organization>;
}

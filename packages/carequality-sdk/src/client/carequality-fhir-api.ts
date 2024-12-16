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
  getOrganization(oid: string): Promise<Organization>;
  listOrganizations(params?: ListOrganizationsParams | undefined): Promise<Organization[]>;
  registerOrganization(org: Organization): Promise<Organization>;
  updateOrganization({ org, oid }: UpdateOrganizationParams): Promise<Organization>;
}

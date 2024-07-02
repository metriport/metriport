import { Organization } from "../models/organization";

export interface CarequalityManagementAPI {
  listOrganizations({
    count,
    start,
    oid,
    isActive,
  }: {
    count?: number;
    start?: number;
    oid?: string;
    isActive?: boolean | undefined;
  }): Promise<Organization[]>;
  registerOrganization(org: string): Promise<string>;
  updateOrganization(org: string, oid: string): Promise<string>;
}

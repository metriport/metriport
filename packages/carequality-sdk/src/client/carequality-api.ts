import { Organization } from "../models/organization";

export interface CarequalityManagementAPI {
  listOrganizations({
    count,
    start,
    oid,
    active,
  }: {
    count?: number;
    start?: number;
    oid?: string;
    active?: boolean | undefined;
  }): Promise<Organization[]>;
  registerOrganization(org: string): Promise<string>;
  updateOrganization(org: string, oid: string): Promise<string>;
}

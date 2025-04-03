import { Organization } from "@medplum/fhirtypes";

export enum APIMode {
  dev = "dev",
  staging = "stage",
  production = "production",
}

export type ListOrganizationsParams = {
  count?: number;
  start?: number;
  oid?: string;
  active?: boolean;
  sortKey?: string;
};

export type OrganizationWithId = Organization & Required<Pick<Organization, "id">>;

export interface CarequalityManagementApi {
  /**
   * Returns a single organization.
   *
   * @param oid Optional, the OID of the organization to fetch.
   * @returns a FHIR R4 Organization resource with the `id` field populated, if found.
   */
  getOrganization(oid: string): Promise<OrganizationWithId | undefined>;

  /**
   * Lists the indicated number of organizations.
   *
   * @param count Optional, number of organizations to fetch. Defaults to 5000.
   * @param start Optional, the index of the directory to start querying from. Defaults to 0.
   * @param oid Optional, the OID of the organization to fetch.
   * @param active Optional, indicates whether to list active or inactive organizations. If not
   *               provided, includes both active and inactive entries.
   * @returns a list of FHIR R4 Organization resources with the `id` field populated.
   */
  listOrganizations(params?: ListOrganizationsParams | undefined): Promise<OrganizationWithId[]>;

  /**
   * Registers an organization with the Carequality directory.
   *
   * @param org a FHIR R4 Organization resource with the `id` field populated
   * @returns a FHIR R4 Organization with the `id` field populated
   */
  registerOrganization(org: OrganizationWithId): Promise<OrganizationWithId>;

  /**
   * Updates an organization with the Carequality directory.
   *
   * @param org a FHIR R4 Organization resource with the `id` field populated
   * @returns a FHIR R4 Organization with the `id` field populated
   */
  updateOrganization(org: OrganizationWithId): Promise<OrganizationWithId>;

  /**
   * Removes an organization from the Carequality directory.
   *
   * @param oid the OID of the organization to delete
   */
  deleteOrganization(oid: string): Promise<void>;
}

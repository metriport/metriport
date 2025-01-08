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
};

export type OrganizationWithId = Organization & Required<Pick<Organization, "id">>;

export interface CarequalityManagementApi {
  /**
   * Returns a single organization.
   *
   * @param oid Optional, the OID of the organization to fetch.
   * @returns
   */
  getOrganization(oid: string): Promise<OrganizationWithId | undefined>;

  /**
   * Lists the indicated number of organizations.
   *
   * @param count Optional, number of organizations to fetch. Defaults to 1000.
   * @param start Optional, the index of the directory to start querying from. Defaults to 0.
   * @param oid Optional, the OID of the organization to fetch.
   * @param active Optional, indicates whether to list active or inactive organizations. If not
   *               provided, includes both active and inactive entries.
   * @returns
   */
  listOrganizations(params?: ListOrganizationsParams | undefined): Promise<OrganizationWithId[]>;

  /**
   * Registers an organization with the Carequality directory.
   *
   * @param org string containing the organization resource (in XML format)
   * @returns an XML string containing an OperationOutcome resource - see Carequality documentation
   * for details - https://carequality.org/healthcare-directory/OperationOutcome-create-success-example2.xml.html
   */
  registerOrganization(org: OrganizationWithId): Promise<OrganizationWithId>;

  /**
   * Updates an organization with the Carequality directory.
   *
   * @param org string containing the organization resource (in XML format) - the organization must
   *            have an id
   * @returns an XML string containing an OperationOutcome resource - see Carequality documentation
   * for details - https://carequality.org/healthcare-directory/OperationOutcome-create-success-example2.xml.html
   */
  updateOrganization(org: OrganizationWithId): Promise<OrganizationWithId>;

  /**
   * Removes an organization from the Carequality directory.
   *
   * @param oid string containing the organization OID
   */
  deleteOrganization(oid: string): Promise<void>;
}

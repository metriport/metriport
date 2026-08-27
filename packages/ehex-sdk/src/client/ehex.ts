import { OrganizationWithId } from "../models/organization";

export enum APIMode {
  dev = "dev",
  staging = "stage",
  production = "production",
}

export type ListOrganizationsParams = {
  count?: number;
  oid?: string;
  active?: boolean;
  sortKey?: string;
  url?: string;
  isHubAware?: boolean;
};

export type ListOrganizationsResponse = {
  organizations: OrganizationWithId[];
  count: number;
  link: Link;
};

export type Link = {
  self: string;
  last: string;
  first: string;
  next: string | undefined;
  previous: string | undefined;
};

export interface EhexManagementApi {
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
   * @param oid Optional, the OID of the organization to fetch.
   * @param active Optional, indicates whether to list active or inactive organizations. If not
   *               provided, includes both active and inactive entries.
   * @param sortKey Optional, the key to sort the organizations by (defaults to "_id"). Valid
   *                values are: _id, _content, _lastUpdated, _profile, _security, _source,
   *                _tag, _text, active, address, address-city, address-country, address-postalcode,
   *                address-state, address-use, endpoint, identifier, name, partof, phonetic, type.
   * @param url Optional, the URL to fetch the organizations from. If provided, the other parameters will be ignored.
   * @returns a bundle of FHIR R4 Organization resources with the `id` field populated and a link resource to the next page of results.
   */
  listOrganizations(
    params?: ListOrganizationsParams | undefined
  ): Promise<ListOrganizationsResponse>;
}

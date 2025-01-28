export interface HieDirectoryEntry {
  oid: string;
  name?: string;
  active: boolean;
  rootOrganization?: string;
  managingOrganizationId?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

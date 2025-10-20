export interface HieDirectoryEntry {
  id: string;
  oid: string;
  name: string;
  active: boolean;
  rootOrganization?: string;
  managingOrganizationId?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  network: "COMMONWELL" | "CAREQUALITY";
}

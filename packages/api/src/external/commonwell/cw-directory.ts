export type CwDirectoryEntryData = {
  id: string;
  name: string;
  oid: string;
  orgType: string;
  rootOrganization: string;
  addressLine: string;
  city: string | undefined;
  state: string | undefined;
  zip: string | undefined;
  data: unknown;
  active: boolean;
  npi?: string;
  delegateOids?: string[];
};

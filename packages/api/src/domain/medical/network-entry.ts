import { USStateForAddress } from "@metriport/shared";

export interface NetworkEntry {
  id: string;
  oid: string;
  name: string;
  zipCode?: string;
  state?: USStateForAddress;
  managingOrgOid?: string;
  rootOrganization?: string;
}
